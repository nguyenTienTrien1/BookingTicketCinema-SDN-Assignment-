import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import app from '../../src/app.js';
import User from '../../src/models/users/User.js';
import { googleClient } from '../../src/services/auth/googleAuthService.js';
import { getJwtSecret } from '../../src/services/auth/loginService.js';

test('Mobile Google OAuth: code flow, account creation, linking and handoff protection', async t => {
  const dbName = `cinema_mobile_google_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => { assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await User.init();
  const config = { GOOGLE_CLIENT_ID: 'mobile-test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-server-secret', GOOGLE_MOBILE_REDIRECT_URI: 'http://localhost:3000/api/auth/mobile/google/callback' };
  const original = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  let clientNumber = 1;
  t.beforeEach(() => clientNumber++);
  async function request(method, path, body, jar = {}, extraHeaders = {}) {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: server.address().port, localAddress: `127.0.0.${clientNumber}`, method, path: '/api/auth/mobile/google' + path,
        headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}), Cookie: Object.entries(jar).map(([key, value]) => `${key}=${value}`).join('; '), ...extraHeaders } }, res => {
        let text = '';
        res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
        res.on('end', () => {
          for (const cookie of res.headers['set-cookie'] || []) { const [name, value] = cookie.split(';')[0].split('='); jar[name] = value; }
          resolve({ status: res.statusCode, headers: res.headers, text, data: res.headers['content-type']?.includes('application/json') ? JSON.parse(text) : null });
        });
      });
      req.on('error', reject); req.end(payload);
    });
  }
  const codes = new Map(), credentials = new Map();
  const tokenExchange = t.mock.method(OAuth2Client.prototype, 'getToken', async function ({ code, codeVerifier }) {
    const value = codes.get(code);
    if (!value) throw new Error('Sensitive provider error must never escape');
    assert.equal(createHash('sha256').update(codeVerifier).digest('base64url'), value.challenge);
    codes.delete(code);
    const credential = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    credentials.set(credential, { iss: 'https://accounts.google.com', aud: config.GOOGLE_CLIENT_ID, iat: now, exp: now + 3600, email_verified: true, ...value.claims });
    return { tokens: { id_token: credential, access_token: 'provider-token-never-delivered-to-app' } };
  });
  t.mock.method(googleClient, 'verifyIdToken', async ({ idToken, audience }) => {
    assert.equal(audience, config.GOOGLE_CLIENT_ID);
    if (!credentials.has(idToken)) throw new Error('Invalid credential');
    return { getPayload: () => credentials.get(idToken) };
  });
  function identity(extra = {}) { return { sub: randomUUID(), email: `${randomUUID()}@mobile-oauth.test`, name: 'Mobile Google Member', ...extra }; }
  async function begin(extra = {}, bearer) {
    const result = await request('POST', '', { returnTo: 'exp://192.168.1.10:8081/--/auth-return', ...extra }, {}, bearer ? { Authorization: `Bearer ${bearer}` } : {});
    assert.equal(result.status, 200, result.text);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(new URL(result.data.browserUrl).origin, 'http://localhost:3000');
    return { ...result.data, jar: {} };
  }
  async function open(value, who = identity(), extraClaims = {}) {
    const response = await request('GET', `/${value.id}`, undefined, value.jar);
    assert.equal(response.status, 302, response.text);
    const url = new URL(response.headers.location);
    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('redirect_uri'), config.GOOGLE_MOBILE_REDIRECT_URI);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.deepEqual(url.searchParams.get('scope').split(' '), ['openid', 'email', 'profile']);
    assert.equal(url.searchParams.has('client_secret'), false);
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    const code = randomUUID(), state = url.searchParams.get('state');
    codes.set(code, { challenge: url.searchParams.get('code_challenge'), claims: { ...who, nonce: url.searchParams.get('nonce'), ...extraClaims } });
    return { code, state };
  }
  const callbackPath = auth => `/callback?${new URLSearchParams(auth)}`;
  const exchange = (value, secret = value.secret) => request('POST', `/${value.id}/exchange`, { secret });

  await t.test('configuration fails clearly without exposing a client secret', async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    try { const result = await request('POST', '', {}); assert.equal(result.status, 503); assert.equal(result.text.includes(config.GOOGLE_CLIENT_SECRET), false); }
    finally { process.env.GOOGLE_CLIENT_SECRET = config.GOOGLE_CLIENT_SECRET; }
    process.env.GOOGLE_MOBILE_REDIRECT_URI = 'http://192.168.1.10:3000/api/auth/mobile/google/callback';
    try { assert.equal((await request('POST', '', {})).status, 503); }
    finally { process.env.GOOGLE_MOBILE_REDIRECT_URI = config.GOOGLE_MOBILE_REDIRECT_URI; }
  });
  await t.test('first Google login creates one verified member and exchanges a session once', async () => {
    const who = identity(), value = await begin(), auth = await open(value, who);
    assert.equal((await exchange(value)).status, 202);
    assert.equal((await exchange(value, '0'.repeat(64))).status, 401);
    assert.equal((await request('GET', callbackPath(auth))).status, 401);
    const tampered = { ...auth, state: auth.state.slice(0, -1) + (auth.state.endsWith('0') ? '1' : '0') };
    assert.equal((await request('GET', callbackPath(tampered), undefined, value.jar)).status, 401);
    assert.equal((await exchange(value)).status, 202);
    const done = await request('GET', callbackPath(auth), undefined, value.jar);
    assert.equal(done.status, 200, done.text);
    assert.equal(done.text.includes('provider-token-never-delivered-to-app'), false);
    assert.equal(done.text.includes(value.secret), false);
    assert.equal((await request('GET', callbackPath(auth), undefined, value.jar)).status, 409);
    const result = await exchange(value);
    assert.equal(result.status, 200, result.text);
    assert.equal(result.data.status, 'complete');
    assert.equal(result.data.user.role, 'member');
    assert.equal(result.data.user.status, 'Active');
    assert.equal(result.data.user.email, who.email);
    assert.equal(jwt.verify(result.data.token, getJwtSecret()).id, result.data.user._id);
    assert.equal(result.data.user.password, undefined);
    assert.equal(result.data.user.googleId, undefined);
    assert.equal((await exchange(value)).status, 410);
    const account = await User.findById(result.data.user._id).select('+googleId');
    assert.equal(account.googleId, who.sub); assert.equal(account.password, undefined);
    const repeat = await begin(), repeatAuth = await open(repeat, who);
    await request('GET', callbackPath(repeatAuth), undefined, repeat.jar);
    assert.equal((await exchange(repeat)).data.user._id, account.id);
    assert.equal(await User.countDocuments({ email: who.email }), 1);
  });
  await t.test('matching email is not silently linked; authenticated linking requires the local password', async () => {
    const who = identity();
    const account = await User.create({ email: who.email, fullName: who.name, password: 'Password123!', status: 'Active', memberPoints: 80 });
    const value = await begin(), auth = await open(value, who);
    await request('GET', callbackPath(auth), undefined, value.jar);
    assert.equal((await exchange(value)).status, 409);
    assert.equal((await User.findById(account.id).select('+googleId')).googleId, undefined);
    assert.equal((await request('POST', '', { purpose: 'link-google' })).status, 401);
    const session = jwt.sign({ id: account.id, tokenVersion: 0 }, getJwtSecret(), { expiresIn: '5m' });
    const link = await begin({ purpose: 'link-google' }, session), linkAuth = await open(link, who);
    const page = await request('GET', callbackPath(linkAuth), undefined, link.jar);
    assert.match(page.text, /Xác nhận liên kết Google/);
    assert.equal((await exchange(link)).status, 202);
    assert.equal((await request('POST', `/${link.id}/complete`, { currentPassword: 'wrong' }, link.jar)).status, 401);
    assert.equal((await request('POST', `/${link.id}/complete`, { currentPassword: 'Password123!' }, link.jar, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await request('POST', `/${link.id}/complete`, { currentPassword: 'Password123!' }, link.jar)).status, 200);
    const result = await exchange(link);
    assert.equal(result.data.user._id, account.id); assert.equal(result.data.user.memberPoints, 80);
    assert.equal((await User.findById(account.id).select('+googleId')).googleId, who.sub);
    assert.equal(await User.countDocuments({ email: who.email }), 1);
  });
  await t.test('unverified email and mismatched nonce cannot create an account', async () => {
    for (const extra of [{ email_verified: false }, { nonce: 'wrong-nonce' }]) {
      const who = identity(), value = await begin(), auth = await open(value, who, extra);
      await request('GET', callbackPath(auth), undefined, value.jar);
      assert.equal((await exchange(value)).status, 401);
      assert.equal(await User.countDocuments({ email: who.email }), 0);
    }
  });
  await t.test('concurrent first logins share one member; cancelled callbacks cannot create accounts', async () => {
    const who = identity();
    const first = await begin(), second = await begin();
    const firstAuth = await open(first, who), secondAuth = await open(second, who);
    await Promise.all([
      request('GET', callbackPath(firstAuth), undefined, first.jar),
      request('GET', callbackPath(secondAuth), undefined, second.jar)
    ]);
    const [a, b] = await Promise.all([exchange(first), exchange(second)]);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.equal(a.data.user._id, b.data.user._id);
    assert.equal(await User.countDocuments({ email: who.email }), 1);
    const cancelledIdentity = identity(), cancelled = await begin(), auth = await open(cancelled, cancelledIdentity);
    await request('POST', `/${cancelled.id}/cancel`, { secret: cancelled.secret });
    assert.equal((await request('GET', callbackPath(auth), undefined, cancelled.jar)).status, 410);
    assert.equal(await User.countDocuments({ email: cancelledIdentity.email }), 0);
  });
  await t.test('banned members and staff identities cannot get a member session', async () => {
    for (const extra of [{ status: 'Banned', role: 'member' }, { status: 'Active', role: 'admin' }]) {
      const who = identity();
      await User.create({ email: who.email, fullName: who.name, googleId: who.sub, googleEmail: who.email, ...extra });
      const value = await begin(), auth = await open(value, who);
      await request('GET', callbackPath(auth), undefined, value.jar);
      assert.equal((await exchange(value)).status, 401);
    }
  });
  await t.test('Google denial reaches the app, cancel is secret-bound, expired handoffs fail', async () => {
    const value = await begin(), auth = await open(value);
    const before = tokenExchange.mock.callCount();
    await request('GET', callbackPath({ state: auth.state, error: 'access_denied' }), undefined, value.jar);
    const denied = await exchange(value);
    assert.equal(denied.status, 400); assert.match(denied.data.message, /hủy/);
    assert.equal(tokenExchange.mock.callCount(), before);
    const cancelled = await begin();
    assert.equal((await request('POST', `/${cancelled.id}/cancel`, { secret: '0'.repeat(64) })).status, 401);
    assert.equal((await request('POST', `/${cancelled.id}/cancel`, { secret: cancelled.secret })).status, 204);
    assert.equal((await exchange(cancelled)).status, 410);
    const expired = await begin();
    const now = Date.now(); const clock = t.mock.method(Date, 'now', () => now + 300001);
    try { assert.equal((await exchange(expired)).status, 410); } finally { clock.mock.restore(); }
  });
  await t.test('token endpoint failures are sanitized and reach only the bound app', async () => {
    const value = await begin(), auth = await open(value);
    auth.code = 'invalid-provider-code';
    const done = await request('GET', callbackPath(auth), undefined, value.jar);
    assert.equal(done.status, 200);
    assert.equal(done.text.includes('Sensitive provider error'), false);
    const result = await exchange(value);
    assert.equal(result.status, 401); assert.match(result.data.message, /đổi mã/);
  });
});
