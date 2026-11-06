import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { googleClient } from '../src/services/auth/googleAuthService.js';

// The Google script and token verification are controlled test doubles. This
// exercises the real React -> Express -> MongoDB flow, not live Google OAuth.
test('Google authentication UI with real API/database and simulated GIS', async t => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const dbName = `cinema_google_ui_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await User.init();
  const originalId = process.env.GOOGLE_CLIENT_ID;
  const originalOrigin = process.env.CORS_ORIGIN;
  process.env.GOOGLE_CLIENT_ID = 'ui-test.apps.googleusercontent.com';
  t.after(() => {
    if (originalId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalId;
    if (originalOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = originalOrigin;
  });
  t.mock.method(googleClient, 'verifyIdToken', async ({ idToken }) => {
    assert.ok(idToken.startsWith('ui-test:'));
    const claims = JSON.parse(idToken.slice(8));
    return { getPayload: () => claims };
  });
  const api = app.listen(0, '127.0.0.1');
  await once(api, 'listening');
  t.after(() => new Promise(resolve => api.close(resolve)));
  async function frontend(clientId) {
    const vite = await createServer({ root: path.join(root, 'frontend'),
      define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(clientId) },
      server: { host: '127.0.0.1', port: 0, proxy: { '/api': `http://127.0.0.1:${api.address().port}` } } });
    await vite.listen();
    t.after(() => vite.close());
    return `http://127.0.0.1:${vite.httpServer.address().port}`;
  }
  const base = await frontend(process.env.GOOGLE_CLIENT_ID);
  process.env.CORS_ORIGIN = base;
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const who = { sub: randomUUID(), email: `${randomUUID()}@google-ui.test`, name: 'Google UI Test' };
  await page.addInitScript(identity => { window.testGoogleIdentity = identity; }, who);
  await page.route('https://accounts.google.com/gsi/client*', route => route.fulfill({ contentType: 'application/javascript', body: `
    (() => {
    let config;
    window.google = { accounts: { id: {
      initialize(value) { config = value; },
      renderButton(container) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Tiếp tục với Google (test)';
        button.onclick = () => {
          const now = Math.floor(Date.now() / 1000);
          config.callback({ credential: 'ui-test:' + JSON.stringify({ ...window.testGoogleIdentity, nonce: config.nonce,
            iat: now, exp: now + 3600, aud: config.client_id, iss: 'https://accounts.google.com', email_verified: true }) });
        };
        container.replaceChildren(button);
      }, disableAutoSelect() {}, cancel() {}
    } } };
    })();
  ` }));
  const screenshotDir = path.join(root, '.local/google-auth-ui');
  await mkdir(screenshotDir, { recursive: true });
  async function screenshot(name) { await page.screenshot({ path: path.join(screenshotDir, name + '.png'), fullPage: true }); }
  async function noOverflow() { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  async function googleButton() { await page.getByRole('button', { name: 'Tiếp tục với Google (test)', exact: true }).click(); }
  async function emailLogin(email, password) {
    await page.getByLabel('Địa chỉ email', { exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL('**/account');
    await page.goto(base + '/account?section=profile');
  }

  await t.test('Google sign-in, Google-only methods, set password, local login and refresh keep one Member', async () => {
    await page.goto(base + '/login');
    await page.getByRole('button', { name: 'Tiếp tục với Google (test)' }).waitFor();
    await screenshot('login-desktop');
    await googleButton();
    await page.waitForURL('**/account');
    await page.goto(base + '/account?section=profile');
    await page.getByRole('heading', { name: /Phương thức đăng nhập/ }).waitFor();
    const account = await User.findOne({ googleId: who.sub }).select('+googleId');
    assert.ok(account);
    assert.equal(account.password, undefined);
    await page.getByText('Chưa thiết lập', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).count(), 0);
    await page.setViewportSize({ width: 375, height: 812 });
    await noOverflow();
    await screenshot('google-only-profile-mobile');
    await page.getByRole('button', { name: 'Đặt mật khẩu', exact: true }).click();
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill('UiPassword123!');
    await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('mismatch');
    await page.getByRole('alert').filter({ hasText: 'không khớp' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Tiếp tục với Google (test)' }).count(), 0);
    await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('UiPassword123!');
    await screenshot('set-password-mobile');
    await googleButton();
    await page.waitForURL('**/login');
    await page.getByRole('status').filter({ hasText: 'Đặt mật khẩu thành công' }).waitFor();
    await emailLogin(who.email, 'UiPassword123!');
    await page.getByRole('heading', { name: /Phương thức đăng nhập/ }).waitFor();
    await page.getByText('Đã thiết lập', { exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: /Phương thức đăng nhập/ }).waitFor();
    assert.equal((await User.findOne({ email: who.email })).id, account.id);
    await noOverflow();
    await screenshot('linked-profile-mobile');
  });

  await t.test('existing local email collision shows linking guidance; linking requires current password', async () => {
    await context.clearCookies();
    const local = await User.create({ fullName: 'Local UI Member', email: `${randomUUID()}@google-ui.test`, password: 'LocalPassword123!', status: 'Active' });
    const identity = { sub: randomUUID(), email: local.email, name: 'Local UI Member' };
    await page.goto(base + '/login');
    await page.evaluate(value => { window.testGoogleIdentity = value; }, identity);
    await googleButton();
    await page.getByRole('alert').filter({ hasText: 'liên kết Google trong' }).first().waitFor();
    assert.equal(await page.getByRole('alert').filter({ hasText: 'liên kết Google trong' }).count(), 1);
    await emailLogin(local.email, 'LocalPassword123!');
    await page.evaluate(value => { window.testGoogleIdentity = value; }, identity);
    await page.getByRole('button', { name: 'Liên kết tài khoản Google', exact: true }).click();
    await page.getByLabel('Mật khẩu Cinema+ hiện tại', { exact: true }).fill('LocalPassword123!');
    await googleButton();
    await page.waitForURL('**/login');
    await page.getByRole('status').filter({ hasText: 'Liên kết Google thành công' }).waitFor();
    await googleButton();
    await page.waitForURL('**/account');
    await page.goto(base + '/account?section=profile');
    await page.getByText('Đã liên kết', { exact: true }).waitFor();
    assert.equal((await User.findOne({ googleId: identity.sub })).id, local.id);
    await page.setViewportSize({ width: 812, height: 375 });
    await noOverflow();
    await screenshot('linked-profile-landscape');
  });

  await t.test('mismatched running backend and frontend Client IDs block Google before opening the popup', async () => {
    await context.clearCookies();
    const configuredId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'different-ui-test.apps.googleusercontent.com';
    try {
      await page.goto(base + '/login');
      await page.getByRole('alert').filter({ hasText: 'Cấu hình đăng nhập Google chưa đồng bộ' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Tiếp tục với Google (test)' }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Đăng nhập', exact: true }).isEnabled(), true);
    } finally { process.env.GOOGLE_CLIENT_ID = configuredId; }
  });

  await t.test('Register, Forgot Password and missing Google Client ID render without runtime errors', async () => {
    await context.clearCookies();
    await page.goto(base + '/register');
    await page.getByLabel('Họ và tên', { exact: true }).waitFor();
    await page.goto(base + '/forgot-password');
    await page.getByLabel('Địa chỉ email', { exact: true }).waitFor();
    const missingBase = await frontend('');
    await page.goto(missingBase + '/login');
    await page.getByRole('status').filter({ hasText: 'Đăng nhập Google chưa được cấu hình' }).waitFor();
    await page.setViewportSize({ width: 375, height: 812 });
    await noOverflow();
    await screenshot('missing-client-id-mobile');
    // Neither side has a Google Client ID. Ordinary login and session restore
    // must still work through the real UI, API and MongoDB.
    delete process.env.GOOGLE_CLIENT_ID;
    const account = await User.create({ fullName: 'Local Without Google', email: `${randomUUID()}@google-ui.test`, password: 'LocalPassword123!', status: 'Active' });
    await page.getByLabel('Địa chỉ email', { exact: true }).fill(account.email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill('LocalPassword123!');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL(missingBase + '/account');
    await page.goto(missingBase + '/account?section=profile');
    await page.getByRole('heading', { name: 'Local Without Google', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Local Without Google', exact: true }).waitFor();
    assert.deepEqual(errors, []);
  });
});
