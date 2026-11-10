import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import app from '../../src/app.js';
import User from '../../src/models/users/User.js';

test('Mobile registration activates from the emailed link without token entry', async t => {
  const dbName = `cinema_mobile_registration_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => { assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await User.init();
  const values = { PUBLIC_API_URL: 'https://cinema-mobile.test', GOOGLE_MOBILE_REDIRECT_URI: 'https://oauth-backend.test/api/auth/mobile/google/callback', CLIENT_URL: 'http://localhost:5173', GMAIL_USER: 'sender@example.test', GMAIL_APP_PASS: 'test-password', SMTP_HOST: 'smtp.example.test' };
  const original = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const emails = [];
  let deliveryFails = false;
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async email => {
    if (deliveryFails) throw new Error('Controlled mail delivery failure');
    emails.push(email); return { messageId: 'test-only-email', accepted: [email.to] };
  } }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  async function post(route, body) {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  function emailLink() { return new URL(emails.at(-1).text.match(/https?:\/\/\S+\/verify-email\?token=[a-f0-9]+/)[0]); }
  function assertSafe(data) { for (const field of ['verificationToken', 'verificationLink', 'previewUrl']) assert.equal(field in data, false); }
  const body = () => ({ fullName: 'Mobile Member', email: `${randomUUID()}@registration.test`, password: 'Password123!', phone: '0912345678' });
  async function open(link) { return fetch(base.replace('/api/auth', '') + link.pathname + link.search); }

  await t.test('register emails a public backend link; opening it activates and enables mobile login', async () => {
    const account = body();
    const created = await post('/mobile/register', account);
    assert.equal(created.status, 201); assert.equal(created.data.emailSent, true); assertSafe(created.data);
    assert.equal((await User.findOne({ email: account.email })).status, 'Pending Verification');
    assert.equal((await post('/mobile/login', account)).status, 401);
    const link = emailLink();
    assert.equal(link.origin, values.PUBLIC_API_URL);
    assert.equal(link.pathname, '/api/auth/mobile/verify-email');
    const response = await open(link), html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(html, /Xác minh email thành công/);
    assert.equal(html.includes(link.searchParams.get('token')), false);
    assert.equal(html.includes('<input'), false);
    const active = await User.findOne({ email: account.email });
    assert.equal(active.status, 'Active'); assert.equal(active.verificationToken, null);
    assert.equal((await post('/mobile/login', account)).status, 200);
    assert.equal((await open(link)).status, 400);
  });
  await t.test('resend and repeated registration send fresh links and invalidate old ones', async () => {
    const account = body();
    await post('/mobile/register', account);
    const oldLink = emailLink();
    const resend = await post('/mobile/resend-verification', { email: account.email });
    assert.equal(resend.data.emailSent, true); assertSafe(resend.data);
    const next = emailLink();
    assert.notEqual(next.href, oldLink.href);
    assert.equal((await open(oldLink)).status, 400);
    const repeated = await post('/mobile/register', account);
    assert.equal(repeated.status, 201); assertSafe(repeated.data);
    assert.equal((await open(next)).status, 400);
    assert.equal((await open(emailLink())).status, 200);
    const before = emails.length;
    assert.equal((await post('/mobile/resend-verification', { email: account.email })).status, 200);
    assert.equal(emails.length, before);
  });
  await t.test('expired, malformed and concurrent link requests fail safely', async () => {
    const account = body(); await post('/mobile/register', account);
    const link = emailLink();
    await User.updateOne({ email: account.email }, { $set: { verificationExpires: new Date(Date.now() - 1000) } });
    assert.equal((await open(link)).status, 400);
    assert.equal((await User.findOne({ email: account.email })).status, 'Pending Verification');
    const missing = await fetch(base + '/mobile/verify-email');
    assert.equal(missing.status, 400); assert.match(await missing.text(), /Chưa xác minh được email/);
    await post('/mobile/resend-verification', { email: account.email });
    const fresh = emailLink();
    const responses = await Promise.all([open(fresh), open(fresh)]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 400]);
    const invalid = new URL(values.PUBLIC_API_URL + '/api/auth/mobile/verify-email?token=' + randomBytes(32).toString('hex'));
    assert.equal((await open(invalid)).status, 400);
  });
  await t.test('uses Google callback origin as fallback, blocks missing config before creating accounts, preserves website links', async () => {
    process.env.PUBLIC_API_URL = '';
    await post('/mobile/register', body());
    assert.equal(emailLink().origin, 'https://oauth-backend.test');
    process.env.GOOGLE_MOBILE_REDIRECT_URI = '';
    const account = body();
    assert.equal((await post('/mobile/register', account)).status, 503);
    assert.equal(await User.countDocuments({ email: account.email }), 0);
    const web = await post('/register', body());
    assert.equal(web.status, 201);
    assert.equal(emailLink().origin, values.CLIENT_URL);
    const webVerification = await fetch(base + '/verify-email' + emailLink().search);
    assert.equal(webVerification.status, 200);
    assert.equal((await webVerification.json()).success, true);
    process.env.PUBLIC_API_URL = values.PUBLIC_API_URL;
    process.env.GOOGLE_MOBILE_REDIRECT_URI = values.GOOGLE_MOBILE_REDIRECT_URI;
  });
  await t.test('failed delivery is reported honestly and keeps the account pending', async () => {
    deliveryFails = true;
    const account = body(), result = await post('/mobile/register', account);
    assert.equal(result.status, 201); assert.equal(result.data.emailSent, false); assertSafe(result.data);
    assert.equal((await User.findOne({ email: account.email })).status, 'Pending Verification');
    assert.equal((await post('/mobile/resend-verification', { email: account.email })).data.emailSent, false);
    deliveryFails = false;
  });
});
