import app from "../../src/app.js";
import mongoose from 'mongoose';
import User from "../../src/models/users/User.js";

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
  assert(rMemberAtAdmin.status === 403 && !rMemberAtAdmin.setCookie, 'TC-08: Staff portal rejects Member without a session');

  const rAdminAtUser = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@cinema.com', password: 'admin123' })
  });
  assert(rAdminAtUser.status === 403 && !rAdminAtUser.setCookie, 'TC-09: Member portal rejects Admin without a session');

  const rEmployeeAtUser = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'employee@cinema.com', password: 'employee123' })
  });
  assert(rEmployeeAtUser.status === 403 && !rEmployeeAtUser.setCookie, 'TC-09b: Member portal rejects Employee without a session');

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

  // =========================================================================
  // 12. UC-1: REGISTER ACCOUNT & EMAIL VERIFICATION (BR-1, BR-8)
  // =========================================================================
  const testRegEmail = 'new_member_test@cinema.com';
  await User.deleteOne({ email: testRegEmail });

  // TC-24: Register new member successfully with status 'Pending Verification' (BR-8)
  const rReg = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Trần Văn Mới',
      email: testRegEmail,
      phone: '0901234567',
      password: 'password123'
    })
  });
  assert(
    rReg.status === 201 &&
    rReg.data.user.status === 'Pending Verification' &&
    rReg.data.verificationToken,
    'TC-24: Register new member creates Pending Verification account (BR-8)'
  );
  const vToken = rReg.data.verificationToken;

  // TC-25: Password must be stored as bcrypt hash in DB (BR-1)
  const createdDbUser = await User.findOne({ email: testRegEmail });
  assert(
    createdDbUser &&
    createdDbUser.password.startsWith('$2') &&
    createdDbUser.password !== 'password123',
    'TC-25: Password stored only as salted bcrypt hash (BR-1)'
  );

  // TC-26: Duplicate registration rejected with 409 (UC-1 Exception E1)
  // (First test when active)
  createdDbUser.status = 'Active';
  await createdDbUser.save();
  const rDup = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Trần Văn Mới',
      email: testRegEmail,
      password: 'password123'
    })
  });
  assert(rDup.status === 409, 'TC-26: Duplicate active email rejected with 409 (UC-1 E1)');

  // TC-27: Unverified account cannot log in (BR-8)
  createdDbUser.status = 'Pending Verification';
  createdDbUser.verificationToken = vToken;
  await createdDbUser.save();

  const rUnverifiedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testRegEmail, password: 'password123' })
  });
  assert(rUnverifiedLogin.status === 401, 'TC-27: Pending Verification account cannot log in (BR-8)');

  // TC-28: Expired verification link (older than 24 hours) rejected (BR-8 Exception E3)
  createdDbUser.verificationExpires = new Date(Date.now() - 1000); // Expired
  await createdDbUser.save();

  const rExpiredVerify = await request(`/api/auth/verify-email?token=${vToken}`);
  assert(rExpiredVerify.status === 400 && rExpiredVerify.data.message.includes('quá 24 giờ'), 'TC-28: Expired verification link (>24h) rejected (BR-8 E3)');

  // TC-29: Resend verification link generates new valid token (BR-8)
  const rResend = await request('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email: testRegEmail })
  });
  assert(rResend.status === 200 && rResend.data.verificationToken, 'TC-29: Resend verification generates new token (BR-8)');
  const newVToken = rResend.data.verificationToken;

  // TC-30: Verify email activates account once (UC-1 Normal Flow)
  const rVerify = await request(`/api/auth/verify-email?token=${newVToken}`);
  assert(rVerify.status === 200 && rVerify.data.user.status === 'Active', 'TC-30: Verification link activates account to Active (BR-8)');

  // TC-31: Single-use verification link cannot be used twice (BR-8)
  const rReuseVerify = await request(`/api/auth/verify-email?token=${newVToken}`);
  assert(rReuseVerify.status === 400, 'TC-31: Single-use verification link cannot be reused (BR-8)');

  // TC-32: Activated member can now log in successfully
  const rActivatedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testRegEmail, password: 'password123' })
  });
  assert(rActivatedLogin.status === 200 && rActivatedLogin.data.user.role === 'member', 'TC-32: Newly activated member logs in successfully');

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

