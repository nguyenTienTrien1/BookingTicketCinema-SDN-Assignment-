import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import app from '../../src/app.js';
import User from '../../src/models/users/User.js';

test('Mobile password email opens the app reset form through a trusted HTTPS bridge', async t => {
  const dbName = `cinema_mobile_reset_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => { assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await User.init();
  const settings = {
    PUBLIC_API_URL: 'https://cinema-reset.test', MOBILE_PASSWORD_RESET_APP_URL: 'exp://192.168.1.10:8081/--/reset-password',
    CLIENT_URL: 'http://localhost:5173', GMAIL_USER: 'sender@example.test', GMAIL_APP_PASS: 'test-only-password',
    SMTP_HOST: 'smtp.example.test', NODE_ENV: 'test'
  };
  const original = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  t.after(() => { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const emails = [];
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async email => {
    emails.push(email); return { messageId: randomUUID(), accepted: [email.to] };
  }, close() {} }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  async function post(route, body) {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  async function waitEmail(count) {
    for (let i = 0; i < 100 && emails.length < count; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(emails.length, count);
    const url = emails.at(-1).text.match(/https?:\/\/[^\s]+reset-password\?token=[a-f0-9]{64}/)?.[0];
    assert.ok(url); return new URL(url);
  }
  function member(extra = {}) { return User.create({ fullName: 'Mobile Reset Member', email: `${randomUUID()}@reset.test`, password: 'OldPassword123!', role: 'member', status: 'Active', ...extra }); }
  function bridge(url) { return fetch(base.replace('/api/auth', '') + url.pathname + url.search); }

  await t.test('email uses HTTPS backend; bridge opens Expo reset route without consuming the token', async () => {
    const user = await member(), count = emails.length;
    const result = await post('/mobile/forgot-password', { email: user.email, returnTo: 'https://attacker.test/steal', resetBaseUrl: 'https://attacker.test/reset-password' });
    assert.equal(result.status, 200); assert.deepEqual(Object.keys(result.data).sort(), ['message', 'success']);
    const url = await waitEmail(count + 1), token = url.searchParams.get('token');
    assert.equal(url.origin, settings.PUBLIC_API_URL); assert.equal(url.pathname, '/api/auth/mobile/reset-password');
    assert.equal(result.data.token, undefined);
    url.searchParams.set('returnTo', 'https://attacker.test/steal');
    const page = await bridge(url), html = await page.text();
    assert.equal(page.status, 200); assert.match(page.headers.get('content-type'), /text\/html/);
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer'); assert.equal(page.headers.get('cache-control'), 'no-store');
    assert.match(page.headers.get('content-security-policy'), /script-src 'nonce-/);
    const href = html.match(/<a href="([^"]+)"/)[1].replaceAll('&amp;', '&');
    const target = new URL(href);
    assert.equal(target.origin, new URL(settings.MOBILE_PASSWORD_RESET_APP_URL).origin);
    assert.equal(target.protocol, 'exp:'); assert.equal(target.host, '192.168.1.10:8081');
    assert.equal(target.pathname, '/--/reset-password'); assert.equal(target.searchParams.get('token'), token);
    assert.match(html, /location.replace\(/); assert.equal(html.includes('attacker.test'), false); assert.equal(html.includes('<input'), false);
    const verify = () => fetch(base + '/reset-password/verify?token=' + token);
    assert.equal((await verify()).status, 200);
    const stored = await User.findById(user.id).select('+passwordResetTokenHash');
    assert.equal(stored.passwordResetTokenHash, createHash('sha256').update(token).digest('hex'));
    const body = { token, newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!' };
    assert.equal((await post('/reset-password', body)).status, 200);
    assert.equal((await post('/mobile/login', { email: user.email, password: body.newPassword })).status, 200);
    assert.equal((await post('/mobile/login', { email: user.email, password: 'OldPassword123!' })).status, 401);
    assert.equal((await verify()).status, 400); assert.equal((await bridge(url)).status, 400);
    assert.equal((await post('/reset-password', body)).status, 400);
  });
  await t.test('unknown, Google-only and inactive accounts receive the same message and no email', async () => {
    const google = await User.create({ fullName: 'Google Member', email: `${randomUUID()}@reset.test`, googleId: randomUUID(), role: 'member', status: 'Active' });
    const inactive = await member({ status: 'Banned' });
    const count = emails.length;
    const responses = await Promise.all([randomUUID() + '@reset.test', google.email, inactive.email].map(email => post('/mobile/forgot-password', { email })));
    for (const response of responses) { assert.equal(response.status, 200); assert.deepEqual(response.data, responses[0].data); }
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(emails.length, count);
  });
  await t.test('installed app links are supported, invalid links never expose a deep-link token', async () => {
    process.env.MOBILE_PASSWORD_RESET_APP_URL = 'cinemaplus://reset-password';
    const user = await member(), count = emails.length;
    await post('/mobile/forgot-password', { email: user.email });
    const url = await waitEmail(count + 1), token = url.searchParams.get('token');
    assert.match(await (await bridge(url)).text(), /cinemaplus:\/\/reset-password\?token=/);
    await User.updateOne({ _id: user.id }, { $set: { passwordResetExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await bridge(url), html = await expired.text();
    assert.equal(expired.status, 400); assert.equal(html.includes(token), false); assert.equal(html.includes('<a href='), false);
    assert.equal((await fetch(base + '/mobile/reset-password')).status, 400);
    process.env.MOBILE_PASSWORD_RESET_APP_URL = settings.MOBILE_PASSWORD_RESET_APP_URL;
  });
  await t.test('untrusted app destinations are rejected; website emails keep their existing URL', async () => {
    for (const url of ['https://attacker.test/reset-password', 'javascript:alert(1)', 'cinemaplus://other-screen']) {
      process.env.MOBILE_PASSWORD_RESET_APP_URL = url;
      assert.equal((await post('/mobile/forgot-password', { email: randomUUID() + '@reset.test' })).status, 503);
    }
    process.env.MOBILE_PASSWORD_RESET_APP_URL = settings.MOBILE_PASSWORD_RESET_APP_URL;
    process.env.NODE_ENV = 'production';
    assert.equal((await post('/mobile/forgot-password', { email: randomUUID() + '@reset.test' })).status, 503);
    process.env.NODE_ENV = 'test';
    const user = await member(), count = emails.length;
    await post('/forgot-password', { email: user.email });
    const url = await waitEmail(count + 1);
    assert.equal(url.origin, settings.CLIENT_URL); assert.equal(url.pathname, '/reset-password');
  });
});
