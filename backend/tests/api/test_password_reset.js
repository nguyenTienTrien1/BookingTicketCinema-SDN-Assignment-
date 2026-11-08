import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import net from 'node:net';
import { test } from 'node:test';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from "../../src/app.js";
import User from "../../src/models/users/User.js";
import { changePassword } from "../../src/services/users/profileService.js";
import { RESET_REQUEST_MESSAGE, INVALID_RESET_MESSAGE, requestPasswordReset } from "../../src/services/auth/passwordResetService.js";
import { createPasswordResetLimiter } from "../../src/middleware/auth/passwordResetRateLimit.js";

const resetFields = '+passwordResetTokenHash +passwordResetExpiresAt +passwordResetUsedAt +passwordResetRequestedAt +passwordResetTokenVersion';
function digest(token) { return createHash('sha256').update(token).digest('hex'); }

async function waitUntil(condition) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail('Timed out waiting for background email processing.');
}

// A real local TCP SMTP receiver exercises Nodemailer's SMTP protocol. No mail
// service is mocked and no test message can be sent to a real member's inbox.
async function startSmtpReceiver() {
  const inbox = { messages: [], deliveries: 0, reject: false, delay: false, pending: [] };
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.setEncoding('utf8');
    socket.write('220 local-test SMTP\r\n');
    let buffer = '';
    let inData = false;
    let message = '';
    socket.on('data', chunk => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            inbox.deliveries++;
            const acceptedMessage = message;
            const finish = () => {
              if (inbox.reject) socket.write('550 simulated delivery failure\r\n');
              else { inbox.messages.push(acceptedMessage); socket.write('250 accepted\r\n'); }
            };
            if (inbox.delay) inbox.pending.push(finish);
            else finish();
          } else message += line + '\r\n';
        } else if (line.startsWith('EHLO')) socket.write('250-local-test\r\n250 AUTH PLAIN\r\n');
        else if (line.startsWith('AUTH')) socket.write('235 authenticated\r\n');
        else if (line === 'DATA') { inData = true; message = ''; socket.write('354 send message\r\n'); }
        else if (line === 'QUIT') { socket.end('221 bye\r\n'); }
        else socket.write('250 ok\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, inbox, sockets };
}

test('UC-19 password recovery: real MongoDB and local SMTP', async t => {
  const dbName = `cinema_password_reset_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    assert.equal(mongoose.connection.name, dbName);
    try { await mongoose.connection.dropDatabase(); }
    finally { await mongoose.disconnect(); }
  });
  await User.init();
  const smtp = await startSmtpReceiver();
  t.after(async () => {
    for (const socket of smtp.sockets) socket.destroy();
    await new Promise(resolve => smtp.server.close(resolve));
  });
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASS;
  Object.assign(process.env, {
    SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.server.address().port), SMTP_USER: 'sender@reset.test',
    SMTP_PASS: randomUUID(), SMTP_SECURE: 'false', EMAIL_FROM: 'Cinema Test <sender@reset.test>',
    CLIENT_URL: 'http://localhost:5173', PASSWORD_RESET_TTL_MINUTES: '30'
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  let clientNumber = 1;
  t.beforeEach(() => { clientNumber++; });
  async function request(method, path, body, session, extraHeaders = {}) {
    const text = body === undefined ? undefined : JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (text) headers['Content-Length'] = Buffer.byteLength(text);
    if (session) headers.Cookie = `token=${session}`;
    return new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: server.address().port, path: '/api' + path, method,
        headers, localAddress: `127.0.0.${clientNumber}` }, res => {
        let response = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { response += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(response), headers: res.headers }));
      });
      req.on('error', reject);
      req.end(text);
    });
  }
  async function member(name = randomUUID(), extra = {}) {
    return User.create({ fullName: 'Reset Test Member', email: `${name}@reset.test`, password: randomUUID(), status: 'Active', ...extra });
  }
  async function issue(user, options = {}) {
    const token = randomBytes(32).toString('hex');
    await User.updateOne({ _id: user._id }, { $set: {
      passwordResetTokenHash: digest(token), passwordResetExpiresAt: new Date(Date.now() + 600000),
      passwordResetUsedAt: null, passwordResetRequestedAt: new Date(), passwordResetTokenVersion: user.tokenVersion || 0, ...options
    } });
    return token;
  }
  const verifyPath = token => '/auth/reset-password/verify?token=' + encodeURIComponent(token);
  const passwordBody = token => ({ token, newPassword: 'New secure password 123', confirmPassword: 'New secure password 123' });
  function session(user) {
    return jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302', { expiresIn: '5m' });
  }
  const audit = [];
  const originalWarn = console.warn;
  const warnMock = t.mock.method(console, 'warn', (...args) => { audit.push(args.join(' ')); });
  t.after(() => warnMock.mock.restore());

  await t.test('eligible normalized Member receives SMTP link; only digest is stored, response contains no token', async () => {
    const user = await member('eligible');
    const oldPasswordHash = user.password;
    const before = smtp.inbox.messages.length;
    const result = await request('POST', '/auth/forgot-password', { email: ' ELIGIBLE@RESET.TEST ' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { success: true, message: RESET_REQUEST_MESSAGE });
    await waitUntil(() => smtp.inbox.messages.length === before + 1);
    const mail = smtp.inbox.messages.at(-1).replace(/=\r\n/g, '').replace(/=3D/g, '=');
    const match = mail.match(/http:\/\/localhost:5173\/reset-password\?token=([a-f0-9]{64})/);
    assert.ok(match, 'SMTP message contains the actual frontend reset URL');
    const saved = await User.findById(user._id).select(resetFields);
    assert.equal(saved.passwordResetTokenHash, digest(match[1]));
    assert.equal(saved.passwordResetUsedAt, null);
    assert.equal(saved.password, oldPasswordHash);
    assert.ok(saved.passwordResetExpiresAt > new Date(Date.now() + 29 * 60000));
    assert.equal(JSON.stringify(saved).includes(match[1]), false);
    assert.equal(JSON.stringify(result.data).includes(match[1]), false);
    assert.equal((await User.findById(user._id)).passwordResetTokenHash, undefined);
    assert.equal((await request('GET', verifyPath(match[1]))).status, 200);
    assert.equal(result.headers['cache-control'], 'no-store');
  });

  await t.test('unknown, pending, banned, inactive, staff and Admin emails receive identical responses and no email', async () => {
    const before = smtp.inbox.deliveries;
    const addresses = ['missing@reset.test'];
    for (const [role, status] of [['member', 'Pending Verification'], ['member', 'Banned'], ['member', 'Inactive'], ['employee', 'Active'], ['admin', 'Active']]) {
      addresses.push((await member(randomUUID(), { role, status })).email);
    }
    for (const email of addresses) {
      const result = await request('POST', '/auth/forgot-password', { email });
      assert.equal(result.status, 200);
      assert.deepEqual(result.data, { success: true, message: RESET_REQUEST_MESSAGE });
    }
    assert.equal(smtp.inbox.deliveries, before);
  });

  await t.test('malformed/structured email inputs are rejected before database lookup', async () => {
    for (const body of [undefined, [], {}, { email: '' }, { email: 'bad@' }, { email: { $ne: '' } }, { email: 'a'.repeat(255) + '@test.test' }]) {
      assert.equal((await request('POST', '/auth/forgot-password', body)).status, 400);
    }
  });

  await t.test('simultaneous forgot requests send one email per cooldown and latest link replaces old one', async () => {
    const user = await member();
    const oldToken = await issue(user, { passwordResetRequestedAt: new Date(Date.now() - 61000) });
    const before = smtp.inbox.messages.length;
    const results = await Promise.all([request('POST', '/auth/forgot-password', { email: user.email }), request('POST', '/auth/forgot-password', { email: user.email })]);
    for (const result of results) assert.equal(result.status, 200);
    await waitUntil(() => smtp.inbox.messages.length === before + 1);
    assert.equal((await request('GET', verifyPath(oldToken))).status, 400);
    assert.equal((await request('POST', '/auth/forgot-password', { email: user.email })).status, 200);
    assert.equal(smtp.inbox.messages.length, before + 1);
  });

  await t.test('SMTP failure keeps generic response and old password, logs safely and invalidates undelivered link', async () => {
    const user = await member();
    smtp.inbox.reject = true;
    const before = smtp.inbox.deliveries;
    try {
      const result = await request('POST', '/auth/forgot-password', { email: user.email });
      assert.deepEqual(result.data, { success: true, message: RESET_REQUEST_MESSAGE });
      await waitUntil(() => smtp.inbox.deliveries > before);
      await waitUntil(async () => (await User.findById(user._id).select(resetFields)).passwordResetTokenHash === null);
      assert.equal((await User.findById(user._id)).password, user.password);
      assert.ok(audit.includes('[PASSWORD RESET] EMAIL_DELIVERY_FAILED'));
    } finally { smtp.inbox.reject = false; }
  });

  await t.test('slow SMTP cannot delay the generic HTTP acknowledgement', async () => {
    const user = await member();
    smtp.inbox.delay = true;
    try {
      const result = await request('POST', '/auth/forgot-password', { email: user.email });
      assert.equal(result.status, 200);
      await waitUntil(() => smtp.inbox.pending.length > 0);
      const before = smtp.inbox.messages.length;
      smtp.inbox.pending.shift()();
      await waitUntil(() => smtp.inbox.messages.length > before);
    } finally { smtp.inbox.delay = false; }
  });

  await t.test('missing real SMTP configuration never falls back to Ethereal or a fake message', async () => {
    const user = await member();
    const host = process.env.SMTP_HOST;
    const before = audit.length;
    process.env.SMTP_HOST = '';
    try {
      assert.equal((await request('POST', '/auth/forgot-password', { email: user.email })).status, 200);
      await waitUntil(() => audit.length > before);
      await waitUntil(async () => (await User.findById(user._id).select(resetFields)).passwordResetTokenHash === null);
      assert.equal((await User.findById(user._id)).password, user.password);
    } finally { process.env.SMTP_HOST = host; }
  });

  await t.test('valid token verification is non-consuming and exposes no account information', async () => {
    const user = await member();
    const token = await issue(user);
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await request('GET', verifyPath(token));
      assert.deepEqual(result.data, { success: true, valid: true });
      assert.equal(result.headers['referrer-policy'], 'no-referrer');
    }
    assert.equal((await User.findById(user._id).select(resetFields)).passwordResetTokenHash, digest(token));
  });

  await t.test('invalid, expired and consumed tokens return the same rejection and never update passwords', async () => {
    const user = await member();
    const tokens = [randomBytes(32).toString('hex')];
    for (const options of [{ passwordResetExpiresAt: new Date(Date.now() - 1000) }, { passwordResetUsedAt: new Date() }]) {
      tokens.push(await issue(user, options));
      const token = tokens.at(-1);
      assert.deepEqual((await request('GET', verifyPath(token))).data, { code: 'RESET_LINK_INVALID', message: INVALID_RESET_MESSAGE });
      assert.equal((await request('POST', '/auth/reset-password', passwordBody(token))).status, 400);
    }
    for (const path of ['/auth/reset-password/verify', verifyPath('bad'), '/auth/reset-password/verify?token[x]=a', '/auth/reset-password/verify?token=a&token=b', verifyPath(tokens[0])]) {
      const result = await request('GET', path);
      assert.equal(result.status, 400);
      assert.equal(result.data.message, INVALID_RESET_MESSAGE);
    }
    assert.equal((await User.findById(user._id)).password, user.password);
  });

  await t.test('short, blank, oversized UTF-8 and mismatched passwords do not consume a valid token', async () => {
    const user = await member();
    const token = await issue(user);
    for (const value of ['', 'short', '      ', 'a'.repeat(73), 'é'.repeat(37), { $ne: '' }]) {
      assert.equal((await request('POST', '/auth/reset-password', { token, newPassword: value, confirmPassword: value })).status, 400);
    }
    assert.equal((await request('POST', '/auth/reset-password', { token, newPassword: 'valid password', confirmPassword: 'different' })).status, 400);
    assert.equal((await request('POST', '/auth/reset-password', { token, newPassword: 'valid password' })).status, 400);
    assert.equal((await request('GET', verifyPath(token))).status, 200);
    assert.equal((await User.findById(user._id)).password, user.password);
  });

  await t.test('expiry after verification, including expiry during bcrypt hashing, is rechecked at update', async () => {
    const user = await member();
    const token = await issue(user);
    assert.equal((await request('GET', verifyPath(token))).status, 200);
    const original = bcrypt.hash;
    const mocked = t.mock.method(bcrypt, 'hash', async function (...args) {
      const hash = await original(...args);
      await User.updateOne({ _id: user._id }, { $set: { passwordResetExpiresAt: new Date(Date.now() - 1000) } });
      return hash;
    });
    try { assert.equal((await request('POST', '/auth/reset-password', passwordBody(token))).status, 400); }
    finally { mocked.mock.restore(); }
    assert.equal((await User.findById(user._id)).password, user.password);
  });

  await t.test('two concurrent resets have exactly one winner; replay and verify then fail', async () => {
    const user = await member();
    const token = await issue(user);
    const results = await Promise.all([request('POST', '/auth/reset-password', passwordBody(token)), request('POST', '/auth/reset-password', passwordBody(token))]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
    const saved = await User.findById(user._id).select(resetFields);
    assert.equal(saved.passwordResetTokenHash, null);
    assert.ok(saved.passwordResetUsedAt instanceof Date);
    assert.equal(saved.tokenVersion, 1);
    assert.equal((await request('POST', '/auth/reset-password', passwordBody(token))).status, 400);
    assert.equal((await request('GET', verifyPath(token))).status, 400);
  });

  await t.test('database update failure preserves old password and token; retry remains possible', async () => {
    const user = await member();
    const token = await issue(user);
    const original = User.updateOne;
    const mocked = t.mock.method(User, 'updateOne', function (filter, update, ...args) {
      if (update.$set && update.$set.password) throw new Error('Private database diagnostic');
      return original.call(this, filter, update, ...args);
    });
    try {
      const result = await request('POST', '/auth/reset-password', passwordBody(token));
      assert.equal(result.status, 500);
      assert.equal(JSON.stringify(result.data).includes('Private'), false);
    } finally { mocked.mock.restore(); }
    const saved = await User.findById(user._id).select(resetFields);
    assert.equal(saved.password, user.password);
    assert.equal(saved.passwordResetTokenHash, digest(token));
    assert.equal(saved.passwordResetUsedAt, null);
    assert.equal((await request('POST', '/auth/reset-password', passwordBody(token))).status, 200);
  });

  await t.test('successful reset changes login password, revokes old JWTs and preserves profile, points and other users', async () => {
    const oldPassword = randomUUID();
    const user = await member(randomUUID(), { password: oldPassword, memberPoints: 75, phone: '0901234567' });
    const other = await member();
    const otherBefore = JSON.stringify(await User.findById(other._id).lean());
    const oldSession = session(user);
    const token = await issue(user);
    const newPassword = '$2b$ThisInputStillNeedsHashing';
    const response = await request('POST', '/auth/reset-password', { token, newPassword, confirmPassword: newPassword, role: 'admin', memberPoints: 999 });
    assert.deepEqual(response.data, { success: true, message: 'Đặt lại mật khẩu thành công.' });
    assert.equal(response.headers['set-cookie'], undefined, 'Reset never logs the Member in');
    assert.equal((await request('GET', '/auth/me', undefined, oldSession)).status, 401);
    assert.equal((await request('GET', '/auth/me', undefined, session(other))).status, 200);
    assert.equal((await request('POST', '/auth/login', { email: user.email, password: oldPassword })).status, 401);
    const login = await request('POST', '/auth/login', { email: user.email, password: newPassword });
    assert.equal(login.status, 200);
    const cookie = login.headers['set-cookie'][0].split(';')[0].slice('token='.length);
    assert.equal((await request('GET', '/auth/me', undefined, cookie)).status, 200);
    const saved = await User.findById(user._id);
    assert.notEqual(saved.password, newPassword);
    assert.equal(await bcrypt.compare(newPassword, saved.password), true);
    assert.equal(saved.memberPoints, 75);
    assert.equal(saved.role, 'member');
    assert.equal(saved.phone, '0901234567');
    assert.equal(JSON.stringify(await User.findById(other._id).lean()), otherBefore);
  });

  await t.test('deactivation/role changes and ordinary password changes invalidate previously issued links', async () => {
    for (const update of [{ status: 'Banned' }, { role: 'employee' }]) {
      const user = await member();
      const token = await issue(user);
      await User.updateOne({ _id: user._id }, { $set: update });
      assert.equal((await request('GET', verifyPath(token))).status, 400);
      assert.equal((await request('POST', '/auth/reset-password', passwordBody(token))).status, 400);
    }
    const currentPassword = randomUUID();
    const user = await member(randomUUID(), { password: currentPassword });
    const token = await issue(user);
    await changePassword(user._id, { currentPassword, newPassword: 'changed password', confirmPassword: 'changed password' });
    assert.equal((await request('GET', verifyPath(token))).status, 400);
    assert.equal((await request('POST', '/auth/reset-password', passwordBody(token))).status, 400);
  });

  await t.test('reset does not bypass a BR-7 lock and supports legacy active Members without tokenVersion', async () => {
    const lockUntil = new Date(Date.now() + 600000);
    const user = await member(randomUUID(), { lockUntil, failedLoginAttempts: 5, status: 'active' });
    await User.collection.updateOne({ _id: user._id }, { $unset: { tokenVersion: '' } });
    const token = await issue(user);
    assert.equal((await request('POST', '/auth/reset-password', passwordBody(token))).status, 200);
    const saved = await User.findById(user._id);
    assert.equal(saved.tokenVersion, 1);
    assert.equal(saved.failedLoginAttempts, 5);
    assert.equal(saved.lockUntil.getTime(), lockUntil.getTime());
    assert.equal((await request('POST', '/auth/login', { email: user.email, password: passwordBody(token).newPassword })).status, 401);
  });

  await t.test('invalid expiry/client URL configuration keeps a generic acknowledgement without changing credentials', async () => {
    const user = await member();
    for (const [key, value] of [['PASSWORD_RESET_TTL_MINUTES', '0'], ['PASSWORD_RESET_TTL_MINUTES', 'bad'], ['CLIENT_URL', 'javascript:alert(1)']]) {
      const previous = process.env[key];
      process.env[key] = value;
      try { await requestPasswordReset({ email: user.email }); }
      finally { process.env[key] = previous; }
    }
    assert.equal((await User.findById(user._id)).password, user.password);
  });

  await t.test('forgot-password storage/read failures do not reveal eligible accounts or change passwords', async () => {
    const user = await member();
    for (const method of ['findOne', 'updateOne']) {
      const mocked = t.mock.method(User, method, () => { throw new Error('Private reset storage diagnostic'); });
      try {
        const result = await request('POST', '/auth/forgot-password', { email: user.email });
        assert.equal(result.status, 200);
        assert.deepEqual(result.data, { success: true, message: RESET_REQUEST_MESSAGE });
      } finally { mocked.mock.restore(); }
    }
    assert.equal((await User.findById(user._id)).password, user.password);
  });

  await t.test('HTTP rate limit is per socket IP, ignores spoofed forwarding headers and sends Retry-After', async () => {
    for (let index = 0; index < 10; index++) {
      assert.equal((await request('POST', '/auth/forgot-password', { email: `missing${index}@reset.test` }, null, { 'X-Forwarded-For': `192.0.2.${index}` })).status, 200);
    }
    const blocked = await request('POST', '/auth/forgot-password', { email: 'missing@reset.test' });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers['retry-after']) > 0);
  });

  await t.test('limiter windows expire and do not depend on email or token values', () => {
    const limiter = createPasswordResetLimiter(1, 1000);
    let now = Date.now();
    const clock = t.mock.method(Date, 'now', () => now);
    let nextCalls = 0;
    let code;
    const res = { set() {}, status(value) { code = value; return this; }, json() {} };
    try {
      limiter({ ip: 'test-ip' }, res, () => nextCalls++);
      limiter({ ip: 'test-ip' }, res, () => nextCalls++);
      assert.equal(nextCalls, 1);
      assert.equal(code, 429);
      now += 1001;
      limiter({ ip: 'test-ip' }, res, () => nextCalls++);
      assert.equal(nextCalls, 2);
    } finally { clock.mock.restore(); }
  });

  await t.test('new recovery logs contain no recipient, token, hash or password', () => {
    for (const line of audit) assert.match(line, /^\[PASSWORD RESET\] [A-Z_]+$/);
    assert.ok(audit.length > 0);
  });
  originalWarn('Password reset tests used an isolated database and a local SMTP receiver.');
});
