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
import Movie from '../src/models/Movie.js';
import Showtime from '../src/models/Showtime.js';
import Booking from '../src/models/Booking.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, '.local', 'qa', 'counter-age');
const dbName = 'cinema_counter_age_ui_' + randomUUID().replaceAll('-', '');
const password = randomUUID();
let server, vite, browser, page, stage = 'setup', checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
process.env.NODE_ENV = 'test';
await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
try {
    await Promise.all([User.init(), Booking.init()]);
    const employee = await User.create({ fullName: 'Age Check Employee', email: 'employee@age-ui.test', password, role: 'employee', status: 'Active' });
    const member = await User.create({ fullName: 'Age Check Member', email: 'member@age-ui.test', password, role: 'member', status: 'Active', age: 25 });
    const cases = [];
    for (const classification of ['P', 'T13', 'T16', 'T18', 'K', 'Legacy']) {
        const movie = await Movie.create({ title: 'Age Check ' + classification, duration: 90, genre: ['Action'], ...(classification === 'Legacy' ? { ageLimit: 16 } : { classification }) });
        const show = await Showtime.create({ movie: movie._id, cinema: 'Age Check Cinema', room: 'Room ' + classification, startTime: new Date(Date.now() + 3600000), price: 80000, seats: ['A1','A2','A3','A4'].map(number => ({ number })) });
        cases.push({ classification, movie, show });
    }
    const { default: app } = await import('../src/app.js');
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    vite = await createServer({ root: path.join(root, 'frontend'), configFile: false, plugins: [react()], logLevel: 'silent',
        define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api'), 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') },
        server: { host: '127.0.0.1', port: 0, open: false, proxy: { '/api': `http://127.0.0.1:${server.address().port}` } } });
    await vite.listen();
    const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
    process.env.CORS_ORIGIN = base;
    browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mkdir(artifacts, { recursive: true });
    await page.goto(base + '/login'); await page.locator('#cinema-email').fill(employee.email); await page.locator('#cinema-password').fill(password);
    await page.locator('.cinemaAuthForm button[type=submit]').click(); await page.waitForURL('**/account');
    const hold = () => page.getByRole('button', { name: 'Giữ ghế & tiếp tục thanh toán', exact: true });
    const checkbox = () => page.locator('#counter-age-confirmation');
    async function chooseShow(item) {
        const card = page.locator('.movieScheduleCard').filter({ has: page.getByRole('heading', { name: item.movie.title, exact: true }) });
        await card.locator('.showtimeBtn').click();
        await page.getByRole('button', { name: /^A1,/ }).click();
        await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
        await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    }
    async function start(item) {
        await page.goto(base + '/account?task=booking');
        await page.getByRole('button', { name: 'Age Check Cinema', exact: true }).click();
        await chooseShow(item);
    }
    for (const item of cases) {
        stage = 'classification ' + item.classification;
        await start(item);
        if (item.classification === 'P') {
            check(await checkbox().count() === 0 && await hold().isEnabled(), 'P can proceed without age confirmation');
        } else {
            check(await checkbox().isVisible(), item.classification + ' has visible required confirmation');
            check(await hold().isDisabled(), item.classification + ' cannot submit unchecked confirmation');
            const invalid = await page.request.post(base + '/api/counter/bookings', { headers: { Origin: base }, data: { customerType: 'guest', showtimeId: item.show.id, seats: ['A1'], points: 0, guardianConfirmed: false } });
            check(invalid.status() === 400, 'Backend independently rejects unchecked ' + item.classification);
            check(await Booking.countDocuments({ showtime: item.show.id }) === 0, 'Rejected request creates no order');
            await checkbox().check(); check(await hold().isEnabled(), 'Checking confirmation enables submission');
        }
        if (item.classification === 'T18') {
            await page.locator('.counterAgeCheck').screenshot({ path: path.join(artifacts, 'desktop.png') });
            await page.setViewportSize({ width: 390, height: 844 });
            check(await page.locator('.counterAgeCheck').evaluate(el => el.scrollWidth <= el.clientWidth), 'Age confirmation fits mobile');
            await page.locator('.counterAgeCheck').screenshot({ path: path.join(artifacts, 'mobile.png') });
            await page.setViewportSize({ width: 1440, height: 1000 });
        }
        const createdResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/counter/bookings' && r.request().method() === 'POST');
        await hold().click();
        const response = await createdResponse, booking = await response.json();
        check(response.status() === 201, 'Employee holds seats for ' + item.classification + ': ' + JSON.stringify(booking.message));
        check(booking.counterEmployee === employee.id && booking.status === 'pending', 'Order belongs to employee and awaits payment');
        await page.getByRole('heading', { name: 'Xác nhận đơn vé', exact: true }).waitFor();
        check(await page.locator('.paymentSubmit').isVisible(), 'Hold opens payment page');
        const heldShow = await Showtime.findById(item.show.id);
        check(heldShow.seats.find(s => s.number === 'A1').status === 'held', 'Seat held in real database');
        page.once('dialog', dialog => dialog.accept());
        const cancelled = page.waitForResponse(r => r.url().endsWith('/cancel'));
        await page.getByRole('button', { name: 'Hủy đơn và giải phóng ghế', exact: true }).click();
        check((await cancelled).status() === 200, 'Cancel releases test hold');
    }
    stage = 'changing movie and customer resets age confirmation';
    const t18 = cases.find(item => item.classification === 'T18'), k = cases.find(item => item.classification === 'K');
    await start(t18); await checkbox().check();
    await page.getByRole('button', { name: '2. Chọn suất chiếu', exact: true }).click(); await chooseShow(k);
    check(!await checkbox().isChecked() && await hold().isDisabled(), 'Different screening resets confirmation');
    await page.getByRole('button', { name: '2. Chọn suất chiếu', exact: true }).click(); await chooseShow(t18);
    check(!await checkbox().isChecked(), 'Returning to old screening does not resurrect confirmation');
    await checkbox().check();
    await page.getByRole('button', { name: '4. Thông tin', exact: true }).click();
    await page.locator('input[name=counterCustomerType][value=member]').check();
    await page.getByLabel('Email hoặc số điện thoại thành viên', { exact: true }).fill(member.email);
    await page.getByRole('button', { name: 'Tìm thành viên', exact: true }).click();
    await page.getByRole('button', { name: /Age Check Member · member@age-ui.test/ }).click();
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    check(!await checkbox().isChecked() && await hold().isDisabled(), 'Different customer needs a new age check');
    await checkbox().check(); check(await hold().isEnabled(), 'Member order can proceed after checking age');
    check(errors.length === 0, 'No browser errors: ' + errors.join('; '));
    console.log(`PASS: ${checks} checks; P/T13/T16/T18/K/legacy, age validation, real holds and payment navigation, customer/screening changes, mobile.`);
} catch (error) {
    console.error('Counter age UI failed at: ' + stage);
    if (page) await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
} finally {
    if (browser) await browser.close(); if (vite) await vite.close(); if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
}
