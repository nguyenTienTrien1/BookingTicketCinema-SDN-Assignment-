import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID, randomBytes, createHash, generateKeyPairSync } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from "../../src/app.js";
import User from "../../src/models/users/User.js";
import Booking from "../../src/models/bookings/Booking.js";
import { googleClient, verifyGoogleCredential } from "../../src/services/auth/googleAuthService.js";
import { getJwtSecret } from "../../src/services/auth/loginService.js";
import { RESET_REQUEST_MESSAGE } from "../../src/services/auth/passwordResetService.js";

test('Multi-provider authentication: real MongoDB, controlled Google verification double', async t => {
  const dbName = `cinema_google_test_${randomUUID().replaceAll('-', '')}`;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema';
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await User.init();
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test-only.apps.googleusercontent.com';
  t.after(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  let clientNumber = 1;
  t.beforeEach(() => clientNumber++);
  const credentials = new Map();
  const verifier = t.mock.method(googleClient, 'verifyIdToken', async ({ idToken, audience }) => {
    assert.equal(audience, process.env.GOOGLE_CLIENT_ID);
    if (!credentials.has(idToken)) throw new Error('Invalid test credential');
    return { getPayload: () => credentials.get(idToken) };
  });
  function identity(extra = {}) {
    return { sub: randomUUID(), email: `${randomUUID()}@google-auth.test`, name: 'Google Test Member', ...extra };
  }
  function credential(who, nonce, extra = {}) {
    const value = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    credentials.set(value, { ...who, nonce, iat: now, exp: now + 3600, aud: process.env.GOOGLE_CLIENT_ID,
      iss: 'https://accounts.google.com', email_verified: true, ...extra });
    return value;
  }
  function session(account) {
    return { token: jwt.sign({ id: account._id, tokenVersion: account.tokenVersion || 0 }, getJwtSecret(), { expiresIn: '5m' }) };
  }
  async function request(method, path, body, jar = {}, extraHeaders = {}) {
    const bodyText = body === undefined ? undefined : JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json', Origin: process.env.CORS_ORIGIN || 'http://localhost:5173', ...extraHeaders };
    headers.Cookie = Object.keys(jar).map(key => `${key}=${jar[key]}`).join('; ');
    if (bodyText) headers['Content-Length'] = Buffer.byteLength(bodyText);
    return new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: server.address().port, method, path: '/api' + path,
        localAddress: `127.0.0.${clientNumber}`, headers }, res => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { text += chunk; });
        res.on('end', () => {
          for (const cookie of res.headers['set-cookie'] || []) {
            const first = cookie.split(';')[0];
            const index = first.indexOf('=');
            jar[first.slice(0, index)] = first.slice(index + 1);
          }
          resolve({ status: res.statusCode, data: JSON.parse(text), headers: res.headers });
        });
      });
      req.on('error', reject);
      req.end(bodyText);
    });
  }
  async function challenge(jar, purpose = 'login') {
    const path = purpose === 'login' ? '/auth/google/challenge' : '/auth/google/reauth-challenge';
    const result = await request('POST', path, { purpose }, jar);
    assert.equal(result.status, 200);
    assert.equal(result.data.clientId, process.env.GOOGLE_CLIENT_ID.trim());
    return result.data.nonce;
  }
  async function login(who, jar = {}, extra = {}) {
    const nonce = await challenge(jar);
    return request('POST', '/auth/google', { credential: credential(who, nonce, extra) }, jar);
  }
  async function local(extra = {}) {
    return User.create({ fullName: 'Local Test Member', email: `${randomUUID()}@google-auth.test`, password: 'Password123!', status: 'Active', ...extra });
  }
  async function googleAccount(who, extra = {}) {
    return User.create({ fullName: who.name, email: who.email, googleId: who.sub, googleEmail: who.email, role: 'member', status: 'Active', ...extra });
  }
  function assertSafe(value) {
    const text = JSON.stringify(value);
    for (const field of ['"password"', '"googleId"', '"tokenVersion"', '"credential"', '"token"']) assert.equal(text.includes(field), false, field);
  }
  let who;
  let memberId;
  let bookingId;

  await t.test('unknown Google identity cannot create a User or receive a session', async () => {
    const unknown = identity();
    const before = await User.countDocuments();
    const jar = {};
    const result = await login(unknown, jar);
    assert.equal(result.status, 404);
    assert.match(result.data.message, /Không tìm thấy tài khoản/);
    assert.equal(jar.token, undefined);
    assert.equal(await User.countDocuments(), before);
    assert.equal(await User.countDocuments({ email: unknown.email }), 0);
  });

  await t.test('existing Google-only Member can sign in without creating a new account', async () => {
    who = identity();
    const existing = await googleAccount(who);
    const before = await User.countDocuments();
    const jar = {};
    const result = await login(who, jar);
    assert.equal(result.status, 200);
    memberId = result.data.user._id;
    assert.equal(memberId, existing.id);
    assert.equal(await User.countDocuments(), before);
    const account = await User.findById(memberId).select('+googleId');
    assert.equal(account.googleId, who.sub);
    assert.equal(account.password, undefined);
    assert.equal(account.role, 'member');
    assert.equal(account.status, 'Active');
    assert.equal(jwt.verify(jar.token, getJwtSecret()).id, memberId);
    assert.ok(result.headers['set-cookie'].some(cookie => cookie.startsWith('token=') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax')));
    assertSafe(result.data);
    const methods = (await request('GET', '/users/me', undefined, jar)).data.user.loginMethods;
    assert.deepEqual(methods, { google: true, local: false, googleEmail: who.email });
    await User.updateOne({ _id: memberId }, { $set: { memberPoints: 350, phone: '0912345678' } });
    const booking = await Booking.create({ user: memberId, showtime: new mongoose.Types.ObjectId(), subtotal: 90000, total: 90000, seats: ['A1'] });
    bookingId = booking.id;
  });

  await t.test('second Google login reuses ID; points, profile and booking ownership survive', async () => {
    const result = await login(who);
    assert.equal(result.data.user._id, memberId);
    assert.equal(result.data.user.memberPoints, 350);
    assert.equal(result.data.user.phone, '0912345678');
    assert.equal(String((await Booking.findById(bookingId)).user), memberId);
    assert.equal(await User.countDocuments({ email: who.email }), 1);
  });

  await t.test('existing account linked between subject and email lookups is reused without a false collision', async () => {
    const originalFind = User.findOne;
    let stale = true;
    const find = t.mock.method(User, 'findOne', function (filter) {
      if (stale && filter.googleId === who.sub) {
        stale = false;
        return { select: async () => null };
      }
      return originalFind.call(this, filter);
    });
    try {
      const result = await login(who);
      assert.equal(result.status, 200);
      assert.equal(result.data.user._id, memberId);
    } finally { find.mock.restore(); }
  });

  await t.test('deleted account stays deleted after password and repeated Google logins; a replacement account is never silently linked', async () => {
    const deletedIdentity = identity();
    const account = await googleAccount(deletedIdentity, { password: 'Password123!' });
    const oldSession = session(account);
    assert.equal((await login(deletedIdentity)).status, 200);
    await User.deleteOne({ _id: account._id });
    const count = await User.countDocuments();
    assert.equal((await request('POST', '/auth/login', { email: account.email, password: 'Password123!' })).status, 401);
    assert.equal((await request('GET', '/auth/me', undefined, oldSession)).status, 401);
    for (let attempt = 0; attempt < 2; attempt++) {
      const jar = {};
      assert.equal((await login(deletedIdentity, jar)).status, 404);
      assert.equal(jar.token, undefined);
    }
    assert.equal(await User.countDocuments(), count);
    assert.equal(await User.countDocuments({ email: account.email }), 0);
    assert.equal(await User.countDocuments({ googleId: deletedIdentity.sub }), 0);
    const replacement = await local({ email: account.email });
    assert.notEqual(replacement.id, account.id);
    assert.equal((await login(deletedIdentity)).status, 409);
    assert.equal((await User.findById(replacement.id).select('+googleId')).googleId, undefined);
  });

  await t.test('Google-only password login fails generically; password reset cannot configure local login', async () => {
    assert.equal((await request('POST', '/auth/login', { email: who.email, password: 'Password123!' })).status, 401);
    const known = await request('POST', '/auth/forgot-password', { email: who.email });
    const unknown = await request('POST', '/auth/forgot-password', { email: 'unknown@google-auth.test' });
    assert.deepEqual(known.data, unknown.data);
    assert.equal(known.data.message, RESET_REQUEST_MESSAGE);
    assert.equal((await User.findById(memberId).select('+passwordResetTokenHash')).passwordResetTokenHash, null);
  });

  await t.test('set password requires a session, challenge, matching fresh Google identity and valid password', async () => {
    assert.equal((await request('POST', '/auth/set-password', {})).status, 401);
    const jar = session(await User.findById(memberId));
    assert.equal((await request('POST', '/auth/set-password', {}, jar)).status, 401);
    const nonce = await challenge(jar, 'set-password');
    const base = { newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!' };
    for (const invalid of [{ newPassword: 'short' }, { confirmPassword: 'mismatch' }, { newPassword: '界'.repeat(25), confirmPassword: '界'.repeat(25) }]) {
      assert.equal((await request('POST', '/auth/set-password', { ...base, credential: credential(who, nonce), ...invalid }, jar)).status, 400);
    }
    assert.equal((await request('POST', '/auth/set-password', { ...base, credential: credential(identity(), nonce) }, jar)).status, 401);
    assert.equal((await User.findById(memberId)).password, undefined);
  });

  await t.test('concurrent set-password saves a bcrypt hash exactly once and revokes previous sessions', async () => {
    const jar = session(await User.findById(memberId));
    const oldSession = { ...jar };
    const nonce = await challenge(jar, 'set-password');
    const body = { newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!', credential: credential(who, nonce) };
    const results = await Promise.all([request('POST', '/auth/set-password', body, { ...jar }), request('POST', '/auth/set-password', body, { ...jar })]);
    assert.equal(results.filter(result => result.status === 200).length, 1);
    const account = await User.findById(memberId).select('+googleId');
    assert.ok(await bcrypt.compare(body.newPassword, account.password));
    assert.equal(account.googleId, who.sub);
    assert.equal(account.memberPoints, 350);
    assert.equal((await request('GET', '/auth/me', undefined, oldSession)).status, 401);
  });

  await t.test('new local password and Google login resolve to the same persisted Member and history', async () => {
    const jar = {};
    const emailResult = await request('POST', '/auth/login', { email: who.email.toUpperCase(), password: 'NewPassword123!' }, jar);
    assert.equal(emailResult.status, 200);
    assert.equal(emailResult.data.user._id, memberId);
    assert.equal((await request('GET', '/users/me', undefined, jar)).data.user.loginMethods.local, true);
    assert.equal((await login(who)).data.user._id, memberId);
    assert.ok((await User.findById(memberId)).password);
    assert.equal(String((await Booking.findById(bookingId)).user), memberId);
    assert.equal((await request('POST', '/auth/logout', {}, jar)).status, 200);
    assert.equal((await request('GET', '/auth/me', undefined, jar)).status, 401);
  });

  await t.test('matching local email never silently links, creates a duplicate, or issues a session', async () => {
    const account = await local();
    const jar = {};
    const result = await login(identity({ email: account.email }), jar);
    assert.equal(result.status, 409);
    assert.match(result.data.message, /liên kết Google/);
    assert.equal(jar.token, undefined);
    assert.equal((await User.findById(account.id).select('+googleId')).googleId, undefined);
    assert.equal(await User.countDocuments({ email: account.email }), 1);
  });

  await t.test('local Member links Google after password reauthentication; both providers retain ID and points', async () => {
    const account = await local({ memberPoints: 200 });
    const linked = identity({ email: account.email });
    const jar = session(account);
    const oldSession = { ...jar };
    const nonce = await challenge(jar, 'link-google');
    const result = await request('POST', '/auth/link-google', { currentPassword: 'Password123!', credential: credential(linked, nonce) }, jar);
    assert.equal(result.status, 200);
    assert.equal((await request('GET', '/auth/me', undefined, oldSession)).status, 401);
    const currentSession = await request('GET', '/auth/me', undefined, jar);
    assert.equal(currentSession.status, 200, 'The browser completing the link stays signed in');
    assert.equal(currentSession.data.user._id, account.id);
    assert.notEqual(jar.token, oldSession.token);
    assert.ok(result.headers['set-cookie'].some(cookie => cookie.startsWith('token=') && cookie.includes('HttpOnly')));
    assert.deepEqual(result.data.user.loginMethods, { google: true, local: true, googleEmail: account.email });
    assertSafe(result.data);
    const localResult = await request('POST', '/auth/login', { email: account.email, password: 'Password123!' });
    const googleResult = await login(linked);
    assert.equal(localResult.data.user._id, account.id);
    assert.equal(googleResult.data.user._id, account.id);
    assert.equal(googleResult.data.user.memberPoints, 200);
    const saved = await User.findById(account.id).select('+googleId');
    assert.equal(saved.password, account.password);
    assert.equal(saved.googleId, linked.sub);
  });

  await t.test('link rejects wrong password, another email, Google ID owned by another user and missing login', async () => {
    assert.equal((await request('POST', '/auth/link-google', {})).status, 401);
    const account = await local();
    const jar = session(account);
    const nonce = await challenge(jar, 'link-google');
    assert.equal((await request('POST', '/auth/link-google', { currentPassword: 'incorrect', credential: credential(identity({ email: account.email }), nonce) }, jar)).status, 401);
    assert.equal((await request('POST', '/auth/link-google', { currentPassword: 'Password123!', credential: credential(identity(), nonce) }, jar)).status, 400);
    assert.equal((await request('POST', '/auth/link-google', { currentPassword: 'Password123!', credential: credential({ ...who, email: account.email }, nonce) }, jar)).status, 409);
    assert.equal((await User.findById(account.id).select('+googleId')).googleId, undefined);
  });

  await t.test('legacy local password migration remains compatible with Google linking', async () => {
    const account = await local();
    await User.collection.updateOne({ _id: account._id }, { $set: { password: 'LegacyPassword123!' } });
    const linked = identity({ email: account.email });
    const jar = session(account);
    const nonce = await challenge(jar, 'link-google');
    assert.equal((await request('POST', '/auth/link-google', { currentPassword: 'LegacyPassword123!', credential: credential(linked, nonce) }, jar)).status, 200);
    const migrated = await User.findById(account.id).select('+googleId');
    assert.ok(await bcrypt.compare('LegacyPassword123!', migrated.password));
    assert.equal(migrated.googleId, linked.sub);
  });

  await t.test('database write failures never report a saved password or Google link', async () => {
    const fresh = identity();
    await googleAccount(fresh);
    const googleJar = {};
    assert.equal((await login(fresh, googleJar)).status, 200);
    const nonce = await challenge(googleJar, 'set-password');
    const account = await local();
    const localJar = session(account);
    const linkNonce = await challenge(localJar, 'link-google');
    const update = t.mock.method(User, 'updateOne', async () => { throw new Error('Private write failure'); });
    try {
      const result = await request('POST', '/auth/set-password', { newPassword: 'Password123!', confirmPassword: 'Password123!', credential: credential(fresh, nonce) }, googleJar);
      assert.equal(result.status, 500);
      assert.equal(JSON.stringify(result.data).includes('Private write failure'), false);
      assert.equal((await User.findOne({ googleId: fresh.sub })).password, undefined);
      assert.equal((await request('POST', '/auth/link-google', { currentPassword: 'Password123!', credential: credential(identity({ email: account.email }), linkNonce) }, localJar)).status, 500);
      assert.equal((await User.findById(account.id).select('+googleId')).googleId, undefined);
    } finally { update.mock.restore(); }
  });

  await t.test('concurrent links to one Google ID have one winner, enforced by the unique index', async () => {
    const account = await local();
    const linked = identity({ email: account.email });
    const jar = session(account);
    const nonce = await challenge(jar, 'link-google');
    const body = { currentPassword: 'Password123!', credential: credential(linked, nonce) };
    const results = await Promise.all([request('POST', '/auth/link-google', body, { ...jar }), request('POST', '/auth/link-google', body, { ...jar })]);
    assert.equal(results.filter(result => result.status === 200).length, 1);
    assert.equal(await User.countDocuments({ googleId: linked.sub }), 1);
  });

  await t.test('fake credentials, wrong audience, expired/unverified/old tokens and missing subject are rejected', async () => {
    const jar = {};
    const nonce = await challenge(jar);
    assert.equal((await request('POST', '/auth/google', { credential: 'fake-token' }, jar)).status, 401);
    const now = Math.floor(Date.now() / 1000);
    for (const extra of [{ aud: 'wrong-client' }, { exp: now - 1 }, { email_verified: false }, { iss: 'https://attacker.test' }, { sub: '' }, { iat: now - 301 }, { iat: now + 301 }, { nonce: 'wrong' }]) {
      const result = await request('POST', '/auth/google', { credential: credential(identity(), nonce, extra) }, jar);
      assert.equal(result.status, 401);
      assertSafe(result.data);
    }
  });

  await t.test('challenge is bound to browser cookie, operation and authenticated Member', async () => {
    const jar = {};
    const nonce = await challenge(jar);
    assert.equal((await request('POST', '/auth/google', { credential: credential(identity(), nonce) })).status, 401);
    const first = await local();
    const second = await local();
    const firstJar = session(first);
    const linkNonce = await challenge(firstJar, 'link-google');
    const wrongJar = { ...firstJar, ...session(second) };
    assert.equal((await request('POST', '/auth/link-google', { credential: credential(identity({ email: second.email }), linkNonce), currentPassword: 'Password123!' }, wrongJar)).status, 401);
    assert.equal((await request('POST', '/auth/set-password', {}, firstJar)).status, 401);
  });

  await t.test('banned, inactive, deactivated and pending accounts cannot use either login method', async () => {
    for (const status of ['Banned', 'Inactive', 'Deactivated', 'Pending Verification', 'inactive', 'blocked']) {
      const blocked = identity();
      const account = await local({ email: blocked.email, googleId: blocked.sub, status });
      assert.equal((await login(blocked)).status, 401);
      assert.equal((await request('POST', '/auth/login', { email: account.email, password: 'Password123!' })).status, 401);
      assert.equal((await User.findById(account.id)).status, status);
    }
  });

  await t.test('staff/Admin collisions and already-linked staff never become Google Members', async () => {
    for (const role of ['employee', 'admin']) {
      const staff = await local({ role });
      assert.equal((await login(identity({ email: staff.email }))).status, 409);
      const linked = identity();
      const account = await local({ role, email: linked.email, googleId: linked.sub });
      assert.equal((await login(linked)).status, 401);
      assert.equal((await request('POST', '/auth/google/reauth-challenge', { purpose: 'link-google' }, session(staff))).status, 403);
      assert.equal((await User.findById(account.id)).role, role);
    }
  });

  await t.test('five failed local logins lock Google login too; expiry permits login again', async () => {
    const linked = identity();
    const account = await local({ email: linked.email, googleId: linked.sub });
    for (let i = 0; i < 5; i++) assert.equal((await request('POST', '/auth/login', { email: account.email, password: 'incorrect' })).status, 401);
    const locked = await User.findById(account.id);
    assert.ok(locked.lockUntil > new Date());
    assert.equal((await login(linked)).status, 401);
    await User.updateOne({ _id: account.id }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
    assert.equal((await login(linked)).status, 200);
    assert.equal((await User.findById(account.id)).failedLoginAttempts, 0);
  });

  await t.test('wrong link-password attempts also enforce BR-7 and lock security actions', async () => {
    const account = await local();
    const jar = session(account);
    const nonce = await challenge(jar, 'link-google');
    const body = { currentPassword: 'incorrect', credential: credential(identity({ email: account.email }), nonce) };
    for (let i = 0; i < 5; i++) assert.equal((await request('POST', '/auth/link-google', body, jar)).status, 401);
    assert.equal((await request('POST', '/auth/link-google', { ...body, currentPassword: 'Password123!' }, jar)).status, 401);
    assert.ok((await User.findById(account.id)).lockUntil > new Date());
  });

  await t.test('simultaneous Google logins for an unknown identity never create a User', async () => {
    const fresh = identity();
    const first = {};
    const second = {};
    const nonce1 = await challenge(first);
    const nonce2 = await challenge(second);
    const results = await Promise.all([
      request('POST', '/auth/google', { credential: credential(fresh, nonce1) }, first),
      request('POST', '/auth/google', { credential: credential(fresh, nonce2) }, second)
    ]);
    assert.deepEqual(results.map(result => result.status), [404, 404]);
    assert.equal(first.token, undefined);
    assert.equal(second.token, undefined);
    assert.equal(await User.countDocuments({ googleId: fresh.sub }), 0);
    assert.equal(await User.countDocuments({ email: fresh.email }), 0);
  });

  await t.test('linked account password reset remains single-use and preserves Google login', async () => {
    const account = await User.findById(memberId);
    const token = randomBytes(32).toString('hex');
    await User.updateOne({ _id: memberId }, { $set: {
      passwordResetTokenHash: createHash('sha256').update(token).digest('hex'), passwordResetExpiresAt: new Date(Date.now() + 60000),
      passwordResetUsedAt: null, passwordResetTokenVersion: account.tokenVersion
    } });
    const body = { token, newPassword: 'ResetPassword123!', confirmPassword: 'ResetPassword123!' };
    assert.equal((await request('POST', '/auth/reset-password', body)).status, 200);
    assert.equal((await request('POST', '/auth/reset-password', body)).status, 400);
    assert.equal((await login(who)).data.user._id, memberId);
    assert.equal((await request('POST', '/auth/login', { email: who.email, password: body.newPassword })).data.user._id, memberId);
  });

  await t.test('security writes reject cross-site/non-JSON requests; missing configuration is explicit', async () => {
    assert.equal((await request('POST', '/auth/google', {}, {}, { Origin: 'https://attacker.test' })).status, 403);
    assert.equal((await request('POST', '/auth/google/challenge', {}, {}, { 'Content-Type': 'text/plain' })).status, 415);
    delete process.env.GOOGLE_CLIENT_ID;
    const result = await request('POST', '/auth/google/challenge', { purpose: 'login' });
    assert.equal(result.status, 503);
    assert.match(result.data.message, /chưa được cấu hình/);
    const account = await local();
    const jar = {};
    const normalLogin = await request('POST', '/auth/login', { email: account.email, password: 'Password123!' }, jar);
    assert.equal(normalLogin.status, 200);
    assert.equal(normalLogin.data.user._id, account.id);
    assert.equal((await request('GET', '/auth/me', undefined, jar)).status, 200);
    process.env.GOOGLE_CLIENT_ID = 'test-only.apps.googleusercontent.com';
  });

  await t.test('legacy local validation, Google-only profile saves and provider persistence across DB reconnect', async () => {
    await assert.rejects(User.create({ fullName: 'No Password', email: `${randomUUID()}@google-auth.test` }), /password/);
    const fresh = identity();
    await googleAccount(fresh);
    const jar = {};
    assert.equal((await login(fresh, jar)).status, 200);
    assert.equal((await request('PATCH', '/users/me', { fullName: 'Updated Google Profile' }, jar)).status, 200);
    await mongoose.disconnect();
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });
    const reloaded = await User.findById(memberId).select('+googleId');
    assert.equal(reloaded.googleId, who.sub);
    assert.ok(await bcrypt.compare('ResetPassword123!', reloaded.password));
    assert.equal((await login(who)).data.user._id, memberId);
    assert.equal(reloaded.memberPoints, 350);
    assert.equal(String((await Booking.findById(bookingId)).user), memberId);
  });

  await t.test('real Google library checks cryptographic signatures, audience and expiration against controlled test certificates', async () => {
    verifier.mock.restore();
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    t.mock.method(googleClient, 'getFederatedSignonCertsAsync', async () => ({ certs: { test: keys.publicKey.export({ type: 'spki', format: 'pem' }) } }));
    const now = Math.floor(Date.now() / 1000);
    const claims = { ...identity(), nonce: 'test-nonce', email_verified: true, aud: process.env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', iat: now, exp: now + 3600 };
    const warnings = [];
    const warning = t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
    function signed(payload, key = keys.privateKey) { return jwt.sign(payload, key, { algorithm: 'RS256', keyid: 'test' }); }
    assert.equal((await verifyGoogleCredential(signed(claims), 'test-nonce')).sub, claims.sub);
    // Real Google certificates and the local PC clock can differ by seconds.
    // These use the real cryptographic verifier with controlled RSA certificates.
    assert.equal((await verifyGoogleCredential(signed({ ...claims, iat: now + 60, exp: now + 3660 }), 'test-nonce')).sub, claims.sub);
    assert.equal((await verifyGoogleCredential(signed({ ...claims, iat: now + 240, exp: now + 3840 }), 'test-nonce')).sub, claims.sub);
    await assert.rejects(verifyGoogleCredential(signed({ ...claims, iat: now + 360, exp: now + 3960 }), 'test-nonce'), { status: 401 });
    await assert.rejects(verifyGoogleCredential(signed(claims, otherKeys.privateKey), 'test-nonce'), { status: 401 });
    await assert.rejects(verifyGoogleCredential(signed({ ...claims, aud: 'other-client' }), 'test-nonce'), { status: 401 });
    await assert.rejects(verifyGoogleCredential(signed({ ...claims, iat: now - 4000, exp: now - 1000 }), 'test-nonce'), { status: 401 });
    warning.mock.restore();
    assert.ok(warnings.some(value => value.includes('AUDIENCE_MISMATCH')));
    assert.ok(warnings.some(value => value.includes('TOKEN_EXPIRED')));
    for (const value of warnings) {
      assert.equal(value.includes(claims.email), false);
      assert.equal(value.includes(claims.sub), false);
      assert.equal(value.includes('eyJ'), false);
    }
  });
});
