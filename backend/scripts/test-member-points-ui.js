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
import Food from '../src/models/Food.js';
import Booking from '../src/models/Booking.js';
import PaymentAttempt from '../src/models/PaymentAttempt.js';
import RevenueEntry from '../src/models/RevenueEntry.js';
import { signature } from '../src/services/vnpayService.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, '.local', 'qa', 'member-points');
const dbName = 'cinema_points_ui_' + randomUUID().replaceAll('-', '');
const password = randomUUID();
let server, vite, browser, page, base, checks = 0, stage = 'setup';
const check = (condition, message) => { assert.ok(condition, message); checks++; };
process.env.NODE_ENV = 'test';
process.env.POINT_REDEEM_STEP = '1';
Object.assign(process.env, { VNPAY_TMN_CODE: 'POINTS_UI', VNPAY_HASH_SECRET: randomUUID(), VNPAY_RETURN_URL: 'http://localhost/api/payments/vnpay/return', VNPAY_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html' });
await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
try {
    check(!!(await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'Use real transactions');
    await Promise.all([User.init(), Booking.init(), PaymentAttempt.init(), RevenueEntry.init()]);
    const member = await User.create({ fullName: 'Member 20 Points', email: 'member@points-ui.test', password, role: 'member', status: 'Active', memberPoints: 20 });
    await User.create({ fullName: 'Points Employee', email: 'employee@points-ui.test', password, role: 'employee', status: 'Active' });
    await User.create({ fullName: 'Member Legacy Step', email: 'legacy@points-ui.test', password, role: 'member', status: 'Active', memberPoints: 20 });
    const movie = await Movie.create({ title: 'Points UI Movie', genre: ['Action'], duration: 90, classification: 'P' });
    const show = await Showtime.create({ movie: movie.id, cinema: 'Points UI Cinema', room: 'Room 1', price: 80000, startTime: new Date(Date.now() + 10800000), seats: Array.from({ length: 12 }, (_, i) => ({ number: 'A' + (i + 1) })) });
    const food = await Food.create({ name: 'Points Popcorn', image: '/assets/foods/popcorn_small.png', price: 69000, stock: 50, available: true });
    const { default: app } = await import('../src/app.js');
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    vite = await createServer({ root: path.join(root, 'frontend'), configFile: false, plugins: [react()], logLevel: 'silent',
        define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api'), 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') },
        server: { host: '127.0.0.1', port: 0, open: false, proxy: { '/api': `http://127.0.0.1:${server.address().port}` } } });
    await vite.listen();
    base = `http://127.0.0.1:${vite.httpServer.address().port}`;
    process.env.CORS_ORIGIN = base;
    browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
    await mkdir(artifacts, { recursive: true });
    const errors = [];
    async function login(name) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
        const p = await context.newPage();
        p.setDefaultTimeout(15000);
        p.on('pageerror', error => errors.push(error.message));
        await p.goto(base + '/login');
        await p.locator('#cinema-email').fill(name + '@points-ui.test');
        await p.locator('#cinema-password').fill(password);
        await p.locator('.cinemaAuthForm button[type=submit]').click();
        await p.waitForURL('**/account');
        await p.locator('.cinemaAuthForm').waitFor({ state: 'detached' });
        return p;
    }
    async function confirmation(p) {
        await p.getByText('Lịch chiếu', { exact: true }).first().click();
        await p.locator('.showtimeSlotBtn').first().click();
        await p.locator('.seat:not(:disabled)').nth(2).click();
        await p.locator('.seat:not(:disabled)').nth(3).click();
        await p.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
        await p.locator('.foodQuantity input').fill('1');
        await p.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
        await p.waitForFunction(() => !document.querySelector('.memberPointsFooter button')?.disabled);
    }
    const submit = () => page.getByRole('button', { name: 'Tạo đơn và chọn thanh toán', exact: true });
    const responseFor = (suffix, method) => page.waitForResponse(r => new URL(r.url()).pathname.endsWith(suffix) && r.request().method() === method);
    const request = (context, method, suffix, data) => context.request[method](base + '/api' + suffix, { data, headers: { Origin: base } });
    async function total(amount) {
        await page.waitForFunction(expected => document.querySelector('.receiptTotal strong')?.textContent === expected, amount.toLocaleString('vi-VN') + 'đ');
        check((await page.locator('.receiptTotal strong').textContent()) === amount.toLocaleString('vi-VN') + 'đ', 'Payment total ' + amount);
    }

    stage = '20-point keyboard input on the 229,000 VND order';
    page = await login('member');
    await confirmation(page);
    const input = page.locator('#online-member-points');
    check((await (await page.request.get(base + '/api/config')).json()).pointRedeemStep === 1, 'Backend exposes single-point redemption');
    await page.getByRole('button', { name: 'Dùng tối đa (20)', exact: true }).waitFor();
    await input.click();
    await input.pressSequentially('20');
    check(await input.inputValue() === '20', 'Typing replaces initial zero with 20');
    check(await input.getAttribute('aria-invalid') === 'false', '20 is valid');
    check((await page.locator('.memberPointsSavings').innerText()).includes('209.000đ'), 'Preview shows 209,000 VND');
    check(await submit().isEnabled(), '20-point booking can be submitted');
    for (const value of ['21', '']) {
        await input.fill(value);
        check(await input.getAttribute('aria-invalid') === 'true', 'Reject invalid points ' + JSON.stringify(value));
        check(await submit().isDisabled(), 'Invalid input cannot submit');
    }
    await page.getByRole('button', { name: '10 điểm Giảm 10.000đ', exact: true }).click();
    check(await input.inputValue() === '10', '10-point quick choice');
    await page.getByRole('button', { name: 'Không dùng Giữ lại điểm', exact: true }).click();
    check(await input.inputValue() === '0', 'Clear redemption');
    await page.getByRole('button', { name: 'Dùng tối đa (20)', exact: true }).click();
    check(await input.inputValue() === '20', 'Use maximum 20 points');

    stage = 'typing while balance refresh is pending or fails';
    let release, started;
    const pending = new Promise(resolve => { release = resolve; });
    const requested = new Promise(resolve => { started = resolve; });
    await page.route('**/api/users/me', async route => {
        const response = await route.fetch();
        started();
        await pending;
        await route.fulfill({ response });
    });
    await input.focus();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await requested;
    try {
        check(await input.isEnabled(), 'Refreshing does not lock input');
        check(await input.evaluate(el => el === document.activeElement), 'Refreshing preserves focus');
        await input.press('ControlOrMeta+A');
        await input.pressSequentially('20');
        check(await input.inputValue() === '20', 'Keyboard works during refresh');
        check(await submit().isDisabled(), 'Wait for authoritative balance before redeeming');
    } finally { release(); }
    await page.waitForFunction(() => !document.querySelector('.memberPointsFooter button').disabled);
    await page.unroute('**/api/users/me');
    await page.route('**/api/users/me', route => route.fulfill({ status: 503, json: { message: 'Test balance unavailable' } }));
    await page.getByRole('button', { name: 'Làm mới số dư', exact: true }).click();
    await page.getByText('Test balance unavailable', { exact: true }).waitFor();
    check(await input.isEnabled(), 'Failed refresh does not lock input');
    check(await submit().isDisabled(), 'Failed refresh prevents stale redemption');
    await page.unroute('**/api/users/me');
    await page.getByRole('button', { name: 'Làm mới số dư', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.memberPointsFooter button').disabled);
    check(await submit().isEnabled(), 'Successful retry restores checkout');
    await page.locator('.memberPointsCard').screenshot({ path: path.join(artifacts, '20-points-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await input.click();
    await input.pressSequentially('20');
    check(await input.inputValue() === '20', 'Mobile-size keyboard input works');
    check(await page.locator('.memberPointsCard').evaluate(el => el.scrollWidth <= el.clientWidth), 'Points card fits mobile');
    await page.locator('.memberPointsCard').screenshot({ path: path.join(artifacts, '20-points-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });

    stage = 'creating the order and changing/removing points in payment';
    const createdResponse = responseFor('/bookings', 'POST');
    await submit().click();
    const response = await createdResponse;
    const booking = await response.json();
    check(response.status() === 201, 'Real browser creates an order: ' + JSON.stringify(booking.message));
    check(booking.subtotal === 229000 && booking.pointsUsed === 20 && booking.discount === 20000 && booking.total === 209000, 'API accepts exact screenshot amounts');
    check((await User.findById(member.id)).memberPoints === 20, 'Creating a pending order does not spend points');
    await total(209000);
    const edit = page.locator('#paymentPoints');
    check(await edit.getAttribute('step') === '1', 'Payment uses same redemption step');
    await edit.fill('10');
    const changed = responseFor('/points', 'PATCH');
    await page.getByRole('button', { name: 'Áp dụng điểm', exact: true }).click();
    check((await changed).status() === 200, 'Apply 10 points');
    await total(219000);
    const removed = responseFor('/points', 'PATCH');
    await page.getByRole('button', { name: 'Bỏ dùng điểm', exact: true }).click();
    check((await removed).status() === 200, 'Remove applied points');
    await total(229000);
    await edit.fill('20');
    const restored = responseFor('/points', 'PATCH');
    await page.getByRole('button', { name: 'Áp dụng điểm', exact: true }).click();
    check((await restored).status() === 200, 'Reapply 20 points');
    await total(209000);
    for (const points of [21, -1, 0.5]) {
        const invalid = await request(page.context(), 'patch', '/bookings/' + booking._id + '/points', { points });
        check(invalid.status() === 400, 'Server rejects invalid points ' + points);
    }
    check((await Booking.findById(booking._id)).pointsUsed === 20, 'Invalid requests preserve applied points');

    stage = 'VNPay-only checkout, settlement and idempotent deduction';
    check(await page.locator('input[name=paymentMethod][value=cash]').count() === 0, 'Online checkout has no cash option');
    check(await page.locator('.simulationBadge').textContent() === 'VNPay Sandbox', 'Online heading advertises VNPay only');
    check(await page.locator('input[name=paymentMethod][value=vnpay]').isChecked(), 'VNPay is selected');
    await page.route('https://sandbox.vnpayment.vn/**', route => route.fulfill({ contentType: 'text/html', body: '<p>VNPay sandbox navigation intercepted by UI test</p>' }));
    const gateway = responseFor('/pay', 'POST');
    await page.locator('.paymentSubmit').click();
    const gatewayResponse = await gateway;
    check(gatewayResponse.status() === 200, 'Online checkout creates a VNPay payment');
    await page.waitForURL('https://sandbox.vnpayment.vn/**');
    const gatewayUrl = new URL(page.url());
    const payment = { reference: gatewayUrl.searchParams.get('vnp_TxnRef') };
    check(gatewayUrl.searchParams.get('vnp_Amount') === '20900000', 'VNPay receives the discounted amount');
    check((await User.findById(member.id)).memberPoints === 20, 'Redirecting to VNPay does not deduct points');
    const ipn = { vnp_TmnCode: process.env.VNPAY_TMN_CODE, vnp_TxnRef: payment.reference, vnp_Amount: '20900000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: '123456789' };
    ipn.vnp_SecureHash = signature(ipn);
    const callbackUrl = base + '/api/payments/vnpay/ipn?' + new URLSearchParams(ipn);
    check((await (await page.request.get(callbackUrl)).json()).RspCode === '00', 'Signed test callback settles the VNPay payment');
    await page.goto(base + '/payment-result?reference=' + payment.reference);
    await page.getByRole('status').filter({ hasText: 'Thanh toán thành công' }).waitFor();
    check((await User.findById(member.id)).memberPoints === 0, 'Deduct exactly 20 points at settlement');
    check((await (await page.request.get(callbackUrl)).json()).RspCode === '02', 'Repeated callback returns already confirmed');
    const after = await User.findById(member.id).select('+redemptionEntries');
    check(after.memberPoints === 0 && after.redemptionEntries.length === 1 && after.redemptionEntries[0].delta === -20, 'Retry does not deduct points twice');
    check((await Food.findById(food.id)).stock === 49, 'Deduct food inventory once');
    const revenue = await RevenueEntry.findOne({ booking: booking._id });
    check(revenue.method === 'vnpay' && revenue.amount === 209000 && revenue.points === 20000, 'Revenue separates VNPay and redeemed points');

    stage = 'zero balance and optional groups of 100';
    await page.goto(base + '/account');
    await confirmation(page);
    check(await input.isEnabled(), 'Zero balance input remains editable');
    await input.fill('1');
    check(await input.getAttribute('aria-invalid') === 'true' && await submit().isDisabled(), 'Zero balance cannot redeem points');
    await page.getByRole('button', { name: 'Không dùng Giữ lại điểm', exact: true }).click();
    check(await submit().isEnabled(), 'Zero balance can book without points');

    stage = 'points-only checkout without a gateway or cash option';
    await User.updateOne({ _id: member.id }, { $set: { memberPoints: 229 } });
    await page.getByRole('button', { name: 'Làm mới số dư', exact: true }).click();
    await page.getByRole('button', { name: 'Dùng tối đa (229)', exact: true }).click();
    const zeroResponse = responseFor('/bookings', 'POST');
    await submit().click();
    const zeroCreated = await zeroResponse;
    const zeroOrder = await zeroCreated.json();
    check(zeroCreated.status() === 201 && zeroOrder.total === 0, 'Fully redeemed order has zero total');
    await total(0);
    check(await page.locator('input[name=paymentMethod]').count() === 0, 'Zero-total checkout has no gateway or cash selector');
    const pointsPaidResponse = responseFor('/pay', 'POST');
    await page.getByRole('button', { name: 'Xác nhận thanh toán bằng điểm', exact: true }).click();
    const pointsPaid = await pointsPaidResponse;
    const pointsOrder = await pointsPaid.json();
    check(pointsPaid.status() === 200 && pointsOrder.status === 'paid' && pointsOrder.paymentMethod === 'points', 'Points-only payment still issues tickets');
    check((await User.findById(member.id)).memberPoints === 0, 'Points-only settlement deducts exactly the redeemed balance');
    check(await PaymentAttempt.countDocuments({ booking: zeroOrder._id, method: { $in: ['cash', 'vnpay'] } }) === 0, 'Points-only payment creates no cash or gateway attempt');

    stage = 'optional groups of 100';
    process.env.POINT_REDEEM_STEP = '100';
    page = await login('legacy');
    await confirmation(page);
    const legacyInput = page.locator('#online-member-points');
    await legacyInput.fill('20');
    check(await legacyInput.getAttribute('aria-invalid') === 'true' && await submit().isDisabled(), 'Explicit step 100 remains supported');
    const legacyOrder = await request(page.context(), 'post', '/bookings', { showtimeId: show.id, seats: ['A11'], points: 20 });
    check(legacyOrder.status() === 400, 'Backend also enforces explicitly configured step 100');
    await page.getByRole('button', { name: 'Không dùng Giữ lại điểm', exact: true }).click();
    check(await submit().isEnabled(), 'Legacy configuration can continue without points');
    delete process.env.POINT_REDEEM_STEP;
    check((await (await page.request.get(base + '/api/config')).json()).pointRedeemStep === 1, 'Default policy is single-point redemption');
    check(errors.length === 0, 'No browser runtime errors: ' + errors.join('; '));
    console.log(`PASS: ${checks} checks; real UI, 20/229000→209000, refresh, mobile, edit/remove, settlement, retry, zero balance, configured step 100.`);
} catch (error) {
    console.error('Member points UI failed at: ' + stage);
    if (page) await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
} finally {
    if (browser) await browser.close();
    if (vite) await vite.close();
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
}
