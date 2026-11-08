import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import User from '../src/models/User.js';
import { startSmtpReceiver, emailedPassword } from '../test-support/smtp.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, '.local', 'qa', 'accounts');
const dbName = 'cinema_accounts_ui_' + randomUUID().replaceAll('-', '');
const password = randomUUID();
let server, vite, browser, smtp, page, checks = 0, stage = 'setup';
const check = (condition, message) => { assert.ok(condition, message); checks++; };
process.env.NODE_ENV = 'test';
await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
try {
    smtp = await startSmtpReceiver();
    await User.init();
    await User.create({ fullName: 'Account Test Admin', email: 'admin@account-ui.test', password, role: 'admin', status: 'Active' });
    const { default: app } = await import('../src/app.js');
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    vite = await createServer({ root: path.join(root, 'frontend'), configFile: false, plugins: [react()], logLevel: 'silent',
        define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api'), 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') },
        server: { host: '127.0.0.1', port: 0, open: false, proxy: { '/api': `http://127.0.0.1:${server.address().port}` } } });
    await vite.listen();
    const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
    process.env.CORS_ORIGIN = base; process.env.CLIENT_URL = base;
    browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
    await mkdir(artifacts, { recursive: true });
    const errors = [], dialogs = [];
    async function login(email, secret) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
        const p = await context.newPage(); p.setDefaultTimeout(15000);
        p.on('pageerror', error => errors.push(error.message));
        p.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.dismiss(); });
        await p.goto(base + '/admin/login');
        await p.locator('#cinema-email').fill(email); await p.locator('#cinema-password').fill(secret);
        await p.locator('.cinemaAuthForm button[type=submit]').click(); await p.waitForURL(/\/(admin|employee)\/dashboard$/); await p.goto(base + '/account');
        await p.locator('.cinemaAuthForm').waitFor({ state: 'detached' }); return p;
    }
    const waitResponse = (suffix, method) => page.waitForResponse(r => new URL(r.url()).pathname.endsWith(suffix) && r.request().method() === method);
    async function fill(name, email) {
        await page.locator('#staff-fullName').fill(name); await page.locator('#staff-email').fill(email); await page.locator('#staff-phone').fill('0901234567');
    }
    async function create(name, email) {
        await fill(name, email); const result = waitResponse('/users', 'POST');
        await page.getByRole('button', { name: 'Tạo tài khoản và gửi email', exact: true }).click();
        return result;
    }
    async function edit(email) { await page.getByRole('button', { name: 'Chỉnh sửa ' + email, exact: true }).click(); }
    async function save(id) { const result = waitResponse('/users/' + id, 'PATCH'); await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); return result; }

    stage = 'creation form desktop/mobile layout';
    page = await login('admin@account-ui.test', password);
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    await page.locator('.accountFormCard').waitFor();
    check(await page.locator('.accountFormCard input[type=password]').count() === 0, 'Admin does not choose or receive plaintext password');
    await page.locator('.accountAdminPage').screenshot({ path: path.join(artifacts, 'create-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    check(await page.locator('.accountFormCard').evaluate(el => el.scrollWidth <= el.clientWidth), 'Create form fits mobile');
    await page.locator('.accountFormCard').screenshot({ path: path.join(artifacts, 'create-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await fill('New Staff', 'newstaff@account-ui.test'); await page.locator('#staff-phone').fill('123');
    check(await page.locator('#staff-phone').evaluate(el => !el.checkValidity()), 'Browser validates phone');
    const createdResponse = await create('New Staff', 'newstaff@account-ui.test');
    const created = await createdResponse.json();
    check(createdResponse.status() === 201 && created.emailSent && created.user.status === 'Active', 'Create sends actual SMTP message and activates account');
    const emailed = emailedPassword(smtp.inbox.messages.at(-1));
    check(!(await page.locator('body').innerText()).includes(emailed), 'Generated password never appears in Admin UI');
    const staff = await login('newstaff@account-ui.test', emailed);
    check(await staff.locator('.adminSidebar').count() === 0, 'Emailed password signs in with Employee permissions');

    stage = 'editing profile and status with no confirmation dialogs';
    await page.getByRole('button', { name: 'Cập nhật tài khoản này', exact: true }).click();
    await page.locator('.accountEditCard').waitFor();
    check(await page.locator('#staff-email').inputValue() === created.user.email, 'New account opens directly in editor');
    await page.locator('#staff-fullName').fill('Updated Staff'); await page.locator('#staff-email').fill('updated@account-ui.test');
    await page.locator('#staff-role').selectOption('admin');
    let saved = await save(created.user._id);
    check(saved.status() === 200, 'Save profile and role in one request');
    check(dialogs.length === 0, 'No confirmation popup before save');
    check((await staff.request.get(base + '/api/auth/me')).status() === 401, 'Changing staff role revokes old session');
    await edit('updated@account-ui.test'); await page.locator('#staff-status').selectOption('Banned');
    saved = await save(created.user._id); check(saved.status() === 200, 'Ban saves directly');
    check((await User.findById(created.user._id)).status === 'Banned', 'Banned status persisted');
    await edit('updated@account-ui.test'); await page.locator('#staff-status').selectOption('Active');
    check((await save(created.user._id)).status() === 200, 'Activate saves directly');
    await page.getByLabel('Tìm tài khoản', { exact: true }).fill('updated@account-ui.test');
    check(await page.locator('.accountUserRow').count() === 1, 'Search finds updated email');
    await edit('updated@account-ui.test');
    await page.locator('.accountAdminPage').screenshot({ path: path.join(artifacts, 'update-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    check(await page.locator('.accountEditCard').evaluate(el => el.scrollWidth <= el.clientWidth), 'Edit form fits mobile');
    await page.locator('.accountEditCard').screenshot({ path: path.join(artifacts, 'update-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });

    stage = 'stale updates require latest data without overwriting';
    const snapshot = await User.findById(created.user._id);
    const external = await page.request.patch(base + '/api/users/' + snapshot.id, { headers: { Origin: base }, data: { fullName: 'Latest Staff', email: snapshot.email, phone: snapshot.phone, role: snapshot.role, status: snapshot.status, version: snapshot.__v, expectedStatus: snapshot.status } });
    check(external.status() === 200, 'Simulate another Admin editing same account');
    await page.locator('#staff-fullName').fill('Stale Name');
    check((await save(snapshot.id)).status() === 409, 'Stale editor cannot overwrite latest account');
    check((await User.findById(snapshot.id)).fullName === 'Latest Staff', 'Latest changes preserved');
    await page.getByRole('button', { name: 'Làm mới danh sách', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#staff-fullName')?.value === 'Latest Staff');

    stage = 'SMTP failure and retry from creation screen';
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    smtp.inbox.reject = true;
    const failureResponse = await create('Retry Staff', 'retry@account-ui.test'); const failure = await failureResponse.json();
    check(failureResponse.status() === 201 && !failure.emailSent, 'Email failure is reported accurately');
    await page.getByText('Email chưa gửi thành công', { exact: true }).waitFor();
    check(failure.user.status === 'Pending Activation', 'Failed email cannot activate account');
    smtp.inbox.reject = false;
    const resendResponse = waitResponse('/credentials-email', 'POST'); await page.getByRole('button', { name: 'Gửi lại email', exact: true }).click();
    check((await resendResponse).status() === 200, 'Retry email succeeds');
    await page.getByText('Đã tạo và gửi email', { exact: true }).waitFor();
    const retryPassword = emailedPassword(smtp.inbox.messages.at(-1));
    const retryContext = await browser.newContext();
    const loginResult = await retryContext.request.post(base + '/api/auth/admin/login', { headers: { Origin: base }, data: { email: 'retry@account-ui.test', password: retryPassword } });
    check(loginResult.status() === 200, 'Retried password is usable');
    await page.getByRole('button', { name: 'Tạo tài khoản khác', exact: true }).click();
    const duplicate = await create('Duplicate', 'retry@account-ui.test');
    check(duplicate.status() === 409, 'Duplicate email displayed as an error');
    check(await page.locator('#staff-email').inputValue() === 'retry@account-ui.test', 'Failed submit keeps entered values');
    check(dialogs.length === 0, 'No confirmation dialogs in create/update flows');
    check(errors.length === 0, 'No browser runtime errors: ' + errors.join('; '));
    console.log(`PASS: ${checks} checks; create/email/login, update name/email/role/status without confirmation, stale writes, SMTP retry, duplicate email, desktop/mobile.`);
} catch (error) {
    console.error('Accounts UI failed at: ' + stage);
    if (page) await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
} finally {
    if (browser) await browser.close(); if (vite) await vite.close(); if (server) await new Promise(resolve => server.close(resolve)); if (smtp) await smtp.close();
    assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
}
