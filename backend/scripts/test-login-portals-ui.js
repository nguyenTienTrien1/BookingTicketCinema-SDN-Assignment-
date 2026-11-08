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
import react from '@vitejs/plugin-react';
import app from '../src/app.js';
import User from '../src/models/User.js';

test('Member and staff login portals with real React, API and temporary database', async t => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const artifacts = path.join(root, '.local/qa/staff-role-separation');
  await mkdir(artifacts, { recursive: true });
  const dbName = 'cinema_login_portals_ui_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await User.init();
  const password = randomUUID();
  for (const role of ['member', 'employee', 'admin']) {
    await User.create({ fullName: role, email: role + '@login-portals.test', password, role, status: 'Active' });
  }
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const vite = await createServer({
    root: path.join(root, 'frontend'), configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api'), 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') },
    server: { host: '127.0.0.1', port: 0, open: false, proxy: { '/api': 'http://127.0.0.1:' + server.address().port } }
  });
  await vite.listen();
  t.after(() => vite.close());
  const base = 'http://127.0.0.1:' + vite.httpServer.address().port;
  const previousOrigin = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = base;
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previousOrigin;
  });
  const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
  t.after(() => browser.close());
  const errors = [];
  const home = role => role === 'admin' ? '/admin/dashboard' : role === 'employee' ? '/employee/dashboard' : '/';
  async function client() {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    return { context, page };
  }
  async function submit(page, role, portal, currentPassword = password) {
    await page.locator('#cinema-email').fill(role + '@login-portals.test');
    await page.locator('#cinema-password').fill(currentPassword);
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth' + portal && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    return response;
  }

  for (const role of ['member', 'employee', 'admin']) {
    await t.test(role + ' is rejected at the wrong portal and can then sign in at the correct one', async () => {
      const { context, page } = await client();
      try {
        const correct = role === 'member' ? '/login' : '/admin/login';
        const wrong = role === 'member' ? '/admin/login' : '/login';
        await page.goto(base + wrong);
        assert.equal((await submit(page, role, wrong)).status(), 403);
        await page.getByRole('alert').filter({ hasText: /cổng|Cổng/ }).waitFor();
        assert.equal(new URL(page.url()).pathname, wrong);
        assert.equal((await context.cookies()).some(cookie => cookie.name === 'token'), false);
        assert.equal((await context.request.get(base + '/api/auth/me')).status(), 401);
        await page.goto(base + correct);
        await page.getByRole('alert').waitFor({ state: 'detached' });
        assert.equal((await submit(page, role, correct)).status(), 200);
        await page.waitForURL(base + home(role));
        await page.locator(role === 'admin' ? '.adminPortalLayout' : role === 'employee' ? '.employeeAccount' : '.cinemaHomeContainer').waitFor();
        const session = await context.request.get(base + '/api/auth/me');
        assert.equal((await session.json()).user.role, role);
        await page.reload();
        await page.locator(role === 'admin' ? '.adminPortalLayout' : role === 'employee' ? '.employeeAccount' : '.cinemaHomeContainer').waitFor();
        assert.equal((await context.request.get(base + '/api/auth/me')).status(), 200);
      } finally { await context.close(); }
    });
  }

  await t.test('staff page has no Google or registration flow and fits a mobile viewport', async () => {
    const { context, page } = await client();
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base + '/admin/login');
      await page.getByRole('heading', { name: 'Đăng nhập nhân sự', exact: true }).waitFor();
      assert.equal(await page.locator('.googleSignInNote, .googleSignInButton').count(), 0);
      assert.equal(await page.getByText('Đăng ký ngay', { exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    } finally { await context.close(); }
  });

  for (const [role, destination] of [['admin', '/admin/movies'], ['employee', '/employee/members'], ['member', '/bookings']]) {
    await t.test(destination + ' uses the correct login portal and role workspace', async () => {
      const { context, page } = await client();
      try {
        const portal = role === 'member' ? '/login' : '/admin/login';
        await page.goto(base + destination);
        await page.waitForURL(base + portal);
        assert.equal((await submit(page, role, portal)).status(), 200);
        await page.waitForURL(base + home(role));
        await page.goto(base + destination);
        await page.waitForURL(base + destination);
      } finally { await context.close(); }
    });
  }
  await t.test('changing a staff password returns to staff login and the new password works', async () => {
    const { context, page } = await client();
    try {
      await page.goto(base + '/admin/login');
      assert.equal((await submit(page, 'employee', '/admin/login')).status(), 200);
      await page.waitForURL(base + '/employee/dashboard');
      await page.goto(base + '/account?section=profile');
      await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
      const newPassword = randomUUID();
      await page.locator('#password-current').fill(password);
      await page.locator('#password-new').fill(newPassword);
      await page.locator('#password-confirm').fill(newPassword);
      await page.getByRole('button', { name: 'Lưu mật khẩu mới', exact: true }).click();
      await page.waitForURL(base + '/admin/login');
      await page.getByRole('status').filter({ hasText: /thành công/ }).waitFor();
      assert.equal((await submit(page, 'employee', '/admin/login', newPassword)).status(), 200);
      await page.waitForURL(base + '/employee/dashboard');
    } finally { await context.close(); }
  });
  for (const role of ['employee', 'admin']) {
    await t.test(role + ' cannot open customer pages, personal booking APIs or customer navigation', async () => {
      const { context, page } = await client();
      try {
        // The previous password-change test changed this Employee's password.
        const account = await User.findOne({ email: role + '@login-portals.test' });
        if (role === 'employee') { account.password = password; await account.save(); }
        await page.goto(base + '/admin/login');
        assert.equal((await submit(page, role, '/admin/login')).status(), 200);
        await page.waitForURL(base + home(role));
        assert.equal(await page.getByText('Xem trang khách', { exact: true }).count(), 0);
        assert.equal(await page.locator('.cinematicNavbar').count(), 0);
        for (const route of ['/', '/movies', '/showtimes', '/cinemas', '/movie-detail', '/booking', '/payment', '/bookings', '/bookings/any/tickets', '/register', '/login']) {
          await page.goto(base + route);
          await page.waitForURL(base + home(role));
          assert.equal(await page.locator('.cinemaHomeContainer, .homeQuickBooking, .bookingApp').count(), 0, route);
        }
        for (const [route, method, data] of [['/api/bookings', 'GET'], ['/api/bookings', 'POST', {}], ['/api/bookings/any/pay', 'POST', { method: 'points' }]]) {
          const result = await context.request.fetch(base + route, { method, data, headers: { Origin: base } });
          assert.equal(result.status(), 403, role + ' ' + route);
        }
        await page.goto(base + home(role) + '?task=booking');
        await page.getByRole('heading', { name: 'Đặt vé tại quầy', exact: true }).waitFor();
        assert.equal(await page.locator('.cinemaHomeContainer').count(), 0);
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: path.join(artifacts, role + '-counter-mobile.png'), fullPage: true });
      } finally { await context.close(); }
    });
  }
  assert.deepEqual(errors, []);
});
