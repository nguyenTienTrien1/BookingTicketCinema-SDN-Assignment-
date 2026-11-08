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
import User from "../../src/models/users/User.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dbName = 'cinema_uc8_ui_' + randomUUID().replaceAll('-', '');
const artifacts = path.join(root, '.local', 'qa', 'uc8');
const password = randomUUID();
let server, vite, browser, activePage, stage = 'setup', checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
process.env.NODE_ENV = 'test';
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
try {
    await User.init();
    const customer = await User.create({ fullName: 'Thành viên UC8', email: 'member@uc8.test', password, phone: '0901234567', role: 'member', status: 'Active', age: 28, gender: 'Female', memberPoints: 200, isVIP: true, lastLogin: new Date() });
    for (const role of ['employee', 'admin']) await User.create({ fullName: role === 'employee' ? 'Nhân viên UC8' : 'Quản trị UC8', email: role + '@uc8.test', password, role, status: 'Active', phone: '0907654321' });
    const { default: app } = await import("../../src/app.js");
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    vite = await createServer({ root: path.join(root, 'frontend'), configFile: false, plugins: [react()], logLevel: 'silent',
        define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api'), 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') },
        server: { host: '127.0.0.1', port: 0, open: false, proxy: { '/api': `http://127.0.0.1:${server.address().port}` } } });
    await vite.listen();
    const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
    process.env.CORS_ORIGIN = base;
    browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
    const errors = [];
    await mkdir(artifacts, { recursive: true });
    async function login(role) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
        const page = await context.newPage(); activePage = page; page.setDefaultTimeout(12000);
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + (role === 'member' ? '/login' : '/admin/login'));
        await page.locator('#cinema-email').fill(role + '@uc8.test');
        await page.locator('#cinema-password').fill(password);
        await page.locator('.cinemaAuthForm button[type=submit]').click();
        await page.waitForURL(base + (role === 'member' ? '/' : role === 'admin' ? '/admin/dashboard' : '/employee/dashboard')); await page.goto(base + '/account');
        return page;
    }
    async function search(page, query) {
        await page.getByLabel('Email hoặc số điện thoại', { exact: true }).fill(query);
        const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/members/search');
        await page.getByRole('button', { name: 'Tìm thành viên', exact: true }).click();
        return (await response).json();
    }
    async function select(page) {
        await page.locator('.memberSearchList button').click();
        await page.locator('.memberSearchDetails').waitFor();
        check(await page.locator('.memberSearchDetail h2').evaluate(el => el === document.activeElement), 'Member detail receives keyboard focus');
    }

    stage = 'Employee profile and grouped tasks';
    const employee = await login('employee');
    await employee.getByRole('heading', { name: 'Hồ sơ nhân viên', exact: true }).waitFor();
    await employee.locator('.memberProfile').waitFor();
    check(await employee.locator('.cinematicNavbar').isVisible(), 'Existing header remains visible');
    const tasks = employee.getByRole('navigation', { name: 'Tác vụ nhân viên' });
    check(await tasks.getByRole('button').count() === 1 && await tasks.getByRole('link').count() === 4, 'Five task entry points are grouped in the profile');
    check(await employee.locator('a[href="/employee/check-in"]').count() === 1, 'Check-in entry is not duplicated below the page');
    await employee.getByRole('button', { name: 'Cập nhật hồ sơ', exact: true }).click();
    await employee.getByLabel('Họ và tên', { exact: true }).waitFor();
    await employee.getByRole('button', { name: 'Hủy', exact: true }).click();
    await employee.screenshot({ path: path.join(artifacts, 'employee-profile-desktop.png'), fullPage: true });
    await employee.setViewportSize({ width: 375, height: 812 });
    check(await employee.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Employee profile fits a mobile viewport');
    const accountButton = await employee.locator('.navUserBtn').boundingBox();
    check(accountButton.x >= 0 && accountButton.x + accountButton.width <= 375, 'Mobile account control stays inside the viewport: ' + JSON.stringify(accountButton));
    await employee.locator('.navUserBtn').click();
    await employee.getByRole('menuitem', { name: 'Hồ sơ & tác vụ nhân viên', exact: true }).waitFor();
    await employee.keyboard.press('Escape');
    await employee.screenshot({ path: path.join(artifacts, 'employee-profile-mobile.png'), fullPage: true });
    await employee.setViewportSize({ width: 1440, height: 1000 });

    stage = 'Employee UC8 search, privacy and error recovery';
    await tasks.getByRole('link', { name: /Tra cứu thành viên/ }).click();
    await employee.getByRole('heading', { name: 'Tra cứu thành viên', exact: true }).waitFor();
    await employee.getByRole('button', { name: 'Tìm thành viên', exact: true }).click();
    await employee.getByRole('alert').waitFor();
    check(await employee.locator('#member-query').evaluate(el => el === document.activeElement), 'Empty search focuses the input');
    const limited = await search(employee, '+84 901 234 567');
    check(limited.members.length === 1 && limited.members[0]._id === String(customer._id), 'Employee finds the complete Vietnamese phone number');
    for (const field of ['age', 'gender', 'lastLogin', 'createdAt', 'password', 'googleId', 'tokenVersion']) check(!(field in limited.members[0]), 'Employee payload excludes ' + field);
    await select(employee);
    check(!(await employee.locator('.memberSearchDetails').innerText()).includes('Ngày tạo tài khoản'), 'Employee UI excludes account activity');
    check(await employee.locator('.memberSearchDetails dt').filter({ hasText: /^Tuổi$/ }).count() === 0, 'Employee UI excludes age');
    await search(employee, 'missing@uc8.test');
    await employee.getByText('Không tìm thấy thành viên phù hợp.', { exact: true }).waitFor();
    check(await employee.locator('.memberSearchDetails').count() === 0, 'No stale member details remain after an empty result');
    await search(employee, '090'); await employee.getByRole('alert').waitFor();
    await search(employee, '  MEMBER@UC8.TEST  '); await select(employee);
    await employee.route('**/api/members/search?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Tra cứu tạm thời gián đoạn.' }) }));
    await search(employee, 'member@uc8.test'); await employee.getByText('Tra cứu tạm thời gián đoạn.', { exact: true }).waitFor();
    check(await employee.locator('.memberSearchDetails').count() === 0, 'Failed requests clear previous member details');
    await employee.unroute('**/api/members/search?*');
    await search(employee, 'member@uc8.test'); await select(employee);
    await employee.screenshot({ path: path.join(artifacts, 'employee-member-search.png'), fullPage: true });
    await employee.getByRole('link', { name: /Hồ sơ & tác vụ nhân viên/ }).click();
    await employee.getByRole('heading', { name: 'Hồ sơ nhân viên', exact: true }).waitFor();
    await tasks.getByRole('button', { name: /Bán vé tại quầy/ }).click();
    await employee.locator('.bookingFlow').waitFor();
    check(await employee.locator('.employeeTaskNav').count() === 0, 'Task panel belongs to the profile instead of every page');
    await employee.goto(base + '/admin/members');
    await employee.waitForURL('**/employee/dashboard?section=profile');
    check(await employee.locator('.memberSearch').count() === 0, 'Employee cannot enter the Admin member route');

    stage = 'Admin UC8 inside the existing portal';
    const admin = await login('admin');
    await admin.locator('.adminPortalLayout').waitFor();
    await admin.locator('.adminSidebar').getByRole('button', { name: 'Tra cứu thành viên', exact: true }).click();
    await admin.getByRole('heading', { name: 'Tra cứu thành viên', exact: true }).waitFor();
    check(await admin.locator('.adminSidebar').isVisible(), 'Admin search preserves the portal sidebar');
    const expanded = await search(admin, 'member@uc8.test');
    check(expanded.members[0].age === 28 && expanded.members[0].gender === 'Female', 'Admin receives the expanded profile');
    for (const field of ['password', 'googleId', 'tokenVersion', 'verificationToken']) check(!(field in expanded.members[0]), 'Admin payload excludes ' + field);
    await select(admin);
    await admin.getByText('Ngày tạo tài khoản', { exact: true }).waitFor();
    await admin.getByText('Đăng nhập gần nhất', { exact: true }).waitFor();
    await admin.screenshot({ path: path.join(artifacts, 'admin-member-search.png'), fullPage: true });
    await admin.goto(base + '/admin/members');
    await admin.waitForURL('**/admin/dashboard?section=members');
    await admin.getByRole('heading', { name: 'Tra cứu thành viên', exact: true }).waitFor();
    check(await admin.locator('.adminSidebarItem.active').innerText() === 'Tra cứu thành viên', 'Direct Admin links select the matching portal item');
    await admin.setViewportSize({ width: 390, height: 844 });
    check(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Embedded Admin search fits mobile');

    stage = 'Member and guest restrictions';
    const member = await login('member');
    await member.getByRole('tab', { name: /Vé của tôi/ }).waitFor();
    check(await member.getByRole('tab', { name: /Vé của tôi/ }).count() === 1, 'Member account keeps its ticket tab');
    check(await member.locator('.employeeTasks').count() === 0, 'Member does not see employee tasks');
    for (const route of ['/employee/members', '/admin/members']) {
        await member.goto(base + route); await member.waitForURL(base + '/');
        check(await member.locator('.memberSearch').count() === 0, 'Member cannot enter ' + route);
    }
    const guest = await browser.newPage(); await guest.goto(base + '/admin/members'); await guest.waitForURL('**/admin/login');
    check(await guest.locator('#cinema-email').isVisible(), 'Guest must log in before Admin member search');
    check(errors.length === 0, 'No browser runtime errors: ' + errors.join('; '));
    console.log(JSON.stringify({ result: 'passed', checks, artifacts, actualApiAndDatabase: true }));
} catch (error) {
    console.error('UC8 browser check failed at: ' + stage);
    if (activePage) { console.error((await activePage.locator('body').innerText()).slice(-1800)); await activePage.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }); }
    throw error;
} finally {
    if (browser) await browser.close();
    if (vite) await vite.close();
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
}
