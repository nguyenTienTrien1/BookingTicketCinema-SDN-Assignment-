import app from './src/app.js';
import mongoose from 'mongoose';
import User from './src/models/User.js';

let server;
let baseUrl;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const cookieHeader = res.headers.get('set-cookie');
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  return { status: res.status, data, setCookie: cookieHeader };
}

function parseTokenCookie(cookieStr) {
  if (!cookieStr) return null;
  const match = cookieStr.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

async function runComprehensiveTests() {
  console.log('====================================================');
  console.log('RUNNING FULL AUTHENTICATION & REGRESSION TEST SUITE');
  console.log('====================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/booking_cinema');
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Existing Cinema APIs Regression Check
  const rMovies = await request('/api/movies');
  assert(rMovies.status === 200 && Array.isArray(rMovies.data) && rMovies.data.length > 0, 'TC-01 [REGRESSION]: GET /api/movies returns movies');

  const rFoods = await request('/api/foods');
  assert(rFoods.status === 200 && Array.isArray(rFoods.data) && rFoods.data.length > 0, 'TC-02 [REGRESSION]: GET /api/foods returns concessions');

  // 2. Member Authentication (UC-18, BR-1)
  const rMember = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'member@cinema.com', password: '123456' })
  });
  assert(rMember.status === 200 && rMember.data.user.role === 'member', 'TC-03: Member login success at /api/auth/login');
  assert(rMember.setCookie && rMember.setCookie.includes('HttpOnly'), 'TC-04: JWT stored in HttpOnly cookie');
  assert(!rMember.data.user.password, 'TC-05: Password hash is never returned in API response');
  const memberToken = parseTokenCookie(rMember.setCookie);

  // 3. Employee Authentication (Shares URL with Admin at /api/auth/admin/login)
  const rEmployee = await request('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'employee@cinema.com', password: 'employee123' })
  });
  assert(rEmployee.status === 200 && rEmployee.data.user.role === 'employee', 'TC-06: Employee login success at /api/auth/admin/login');
  const employeeToken = parseTokenCookie(rEmployee.setCookie);

  // 4. Admin Authentication
  const rAdmin = await request('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@cinema.com', password: 'admin123' })
  });
  assert(rAdmin.status === 200 && rAdmin.data.user.role === 'admin', 'TC-07: Admin login success at /api/auth/admin/login');
  const adminToken = parseTokenCookie(rAdmin.setCookie);

  // 5. Role Portal Separation & Generic Errors
  const rMemberAtAdmin = await request('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'member@cinema.com', password: '123456' })
  });
  assert(rMemberAtAdmin.status === 401 && rMemberAtAdmin.data.message === 'Email hoặc mật khẩu không chính xác.', 'TC-08: Member rejected at admin portal with generic message');

  const rAdminAtUser = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@cinema.com', password: 'admin123' })
  });
  assert(rAdminAtUser.status === 401 && rAdminAtUser.data.message === 'Email hoặc mật khẩu không chính xác.', 'TC-09: Admin rejected at user portal with generic message');

  const rEmployeeAtUser = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'employee@cinema.com', password: 'employee123' })
  });
  assert(rEmployeeAtUser.status === 401 && rEmployeeAtUser.data.message === 'Email hoặc mật khẩu không chính xác.', 'TC-09b: Employee rejected at user portal with generic message');

  // 6. Generic Non-Disclosing Responses for Bad Password or Missing Email
  const rBadPass = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'member@cinema.com', password: 'wrong' })
  });
  assert(rBadPass.status === 401 && rBadPass.data.message === 'Email hoặc mật khẩu không chính xác.', 'TC-10: Bad password returns generic 401');

  const rUnknownUser = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'unknown_user_999@cinema.com', password: 'password123' })
  });
  assert(rUnknownUser.status === 401 && rUnknownUser.data.message === 'Email hoặc mật khẩu không chính xác.', 'TC-11: Non-existent email returns identical generic 401 (BR-7)');

  // 7. Account Lockout Verification (BR-7)
  await User.deleteOne({ email: 'lockout_demo@cinema.com' });
  await User.create({
    fullName: 'Lockout Demo',
    email: 'lockout_demo@cinema.com',
    password: 'correctpassword',
    role: 'member',
    status: 'Active'
  });

  for (let i = 1; i <= 4; i++) {
    await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'lockout_demo@cinema.com', password: 'bad' })
    });
  }

  // 5th attempt locks the account
  const rLock5 = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'lockout_demo@cinema.com', password: 'bad' })
  });
  assert(rLock5.status === 401, 'TC-12: 5th attempt returns 401');

  const lockedDoc = await User.findOne({ email: 'lockout_demo@cinema.com' });
  assert(lockedDoc.failedLoginAttempts === 5 && lockedDoc.lockUntil > new Date(), 'TC-13: Lockout duration set for 15 minutes (BR-7)');

  // 6th attempt with CORRECT password must still be rejected
  const rLock6 = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'lockout_demo@cinema.com', password: 'correctpassword' })
  });
  assert(rLock6.status === 401 && rLock6.data.message === 'Email hoặc mật khẩu không chính xác.', 'TC-14: Correct password rejected during lockout with non-disclosing error');

  // 8. Account Status Verification (BR-8 & UC-18 Exception E2)
  const rPending = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'pending@cinema.com', password: '123456' })
  });
  assert(rPending.status === 401 && rPending.data.message === 'Email hoặc mật khẩu không chính xác.', 'TC-15: Pending Verification account cannot log in (BR-8)');

  const rBanned = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'banned@cinema.com', password: '123456' })
  });
  assert(rBanned.status === 401 && rBanned.data.message === 'Email hoặc mật khẩu không chính xác.', 'TC-16: Banned account cannot log in');

  // 9. Session Retrieval (GET /api/auth/me)
  const rMe = await request('/api/auth/me', {
    headers: { Cookie: `token=${memberToken}` }
  });
  assert(rMe.status === 200 && rMe.data.user.email === 'member@cinema.com', 'TC-17: Authenticated session retrieved via HttpOnly cookie');

  const rMeNoToken = await request('/api/auth/me');
  assert(rMeNoToken.status === 401, 'TC-18: Unauthenticated access to /api/auth/me returns 401');

  // 10. Role-based Dashboard Authorization (BR-11)
  const rMemberDash = await request('/api/member/dashboard', {
    headers: { Cookie: `token=${memberToken}` }
  });
  assert(rMemberDash.status === 200, 'TC-19: Member permitted on Member Dashboard');

  const rMemberForbidden = await request('/api/admin/dashboard', {
    headers: { Cookie: `token=${memberToken}` }
  });
  assert(rMemberForbidden.status === 403, 'TC-20: Member forbidden on Admin Dashboard (403)');

  const rEmployeeDash = await request('/api/employee/dashboard', {
    headers: { Cookie: `token=${employeeToken}` }
  });
  assert(rEmployeeDash.status === 200, 'TC-21: Employee permitted on Employee Dashboard');

  const rAdminDash = await request('/api/admin/dashboard', {
    headers: { Cookie: `token=${adminToken}` }
  });
  assert(rAdminDash.status === 200, 'TC-22: Admin permitted on Admin Dashboard');

  // 11. Logout & Session Termination
  const rLogout = await request('/api/auth/logout', { method: 'POST' });
  assert(rLogout.status === 200 && rLogout.setCookie && rLogout.setCookie.includes('token=;'), 'TC-23: Logout successfully clears HttpOnly cookie');

  console.log('\n====================================================');
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED.`);
  console.log('====================================================\n');

  server.close();
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runComprehensiveTests().catch(e => {
  console.error('Test suite failure:', e);
  if (server) server.close();
  mongoose.disconnect();
  process.exit(1);
});

