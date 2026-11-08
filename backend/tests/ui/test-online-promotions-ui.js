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
import Movie from "../../src/models/movies/Movie.js";
import Showtime from "../../src/models/cinema/Showtime.js";
import Food from "../../src/models/catalogue/Food.js";
import Promotion from "../../src/models/catalogue/Promotion.js";
import Booking from "../../src/models/bookings/Booking.js";
import PaymentAttempt from "../../src/models/payments/PaymentAttempt.js";
import { signature } from "../../src/services/payments/vnpayService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const artifacts = path.join(root, '.local', 'qa', 'online-promotions');
const dbName = 'cinema_online_promotions_ui_' + randomUUID().replaceAll('-', '');
const password = randomUUID();
let server, vite, browser, page, checks = 0, stage = 'setup';
const check = (value, message) => { assert.ok(value, message); checks++; };
process.env.NODE_ENV = 'test'; process.env.POINT_REDEEM_STEP = '1';
Object.assign(process.env, { VNPAY_TMN_CODE: 'ONLINE_UI_TEST', VNPAY_HASH_SECRET: randomUUID(), VNPAY_RETURN_URL: 'http://localhost/api/payments/vnpay/return', VNPAY_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html' });
await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
try {
    await Promise.all([User.init(), Booking.init(), Promotion.init(), PaymentAttempt.init()]);
    const member = await User.create({ fullName: 'Online Member', email: 'member@online-ui.test', password, role: 'member', status: 'Active', memberPoints: 20 });
    const movie = await Movie.create({ title: 'Online Promotion Movie', classification: 'P', duration: 90, genre: ['Action'] });
    await Showtime.create({ movie: movie.id, cinema: 'Online Cinema', room: 'Room 1', price: 80000, startTime: new Date(Date.now() + 10800000), seats: Array.from({ length: 12 }, (_, i) => ({ number: 'A' + (i + 1) })) });
    const food = await Food.create({ name: 'Popcorn', price: 69000, stock: 50, available: true });
    const common = { startsAt: new Date(Date.now() - 3600000), endsAt: new Date(Date.now() + 3600000), minOrder: 0, stackable: true, usageLimit: 10, discountType: 'percentage', scope: 'all' };
    const sale = await Promotion.create({ ...common, code: 'SALE10', name: 'Online 10%', value: 10 });
    const foodCode = await Promotion.create({ ...common, code: 'FOOD20', name: 'Food 20%', value: 20, scope: 'food' });
    await Promotion.create({ ...common, code: 'ONLY30K', name: 'Exclusive 30K', discountType: 'fixed', value: 30000, stackable: false });
    const free = await Promotion.create({ ...common, code: 'FREE100', name: 'Free order', value: 100 });
    const { default: app } = await import("../../src/app.js");
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    vite = await createServer({ root: path.join(root, 'frontend'), configFile: false, plugins: [react()], logLevel: 'silent',
        define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api'), 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') },
        server: { host: '127.0.0.1', port: 0, open: false, proxy: { '/api': `http://127.0.0.1:${server.address().port}` } } });
    await vite.listen(); const base = `http://127.0.0.1:${vite.httpServer.address().port}`; process.env.CORS_ORIGIN = base;
    browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message)); await mkdir(artifacts, { recursive: true });
    await page.goto(base + '/login'); await page.locator('#cinema-email').fill(member.email); await page.locator('#cinema-password').fill(password);
    await page.locator('.cinemaAuthForm button[type=submit]').click(); await page.waitForURL(base + '/'); await page.goto(base + '/account');
    await page.locator('.cinemaAuthForm').waitFor({ state: 'detached' });
    const responseFor = (suffix, method = 'PATCH') => page.waitForResponse(r => new URL(r.url()).pathname.endsWith(suffix) && r.request().method() === method);
    async function total(amount) { await page.waitForFunction(expected => document.querySelector('.receiptTotal strong')?.textContent === expected, amount.toLocaleString('vi-VN') + 'đ'); check(true, 'Total ' + amount); }
    async function createOrder() {
        await page.getByText('Lịch chiếu', { exact: true }).first().click(); await page.locator('.showtimeSlotBtn').first().click();
        await page.locator('.seat:not(:disabled)').nth(0).click(); await page.locator('.seat:not(:disabled)').nth(1).click();
        await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click(); await page.locator('.foodQuantity input').fill('1');
        await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
        if (await Booking.countDocuments() === 0) {
            const beforeSeats = (await Showtime.findOne()).seats.map(s => s.status);
            await page.getByRole('heading', { name: 'Mã khuyến mãi', exact: true }).waitFor();
            await page.getByRole('combobox', { name: 'Mã khuyến mãi', exact: true }).fill('INVALID');
            check(await page.getByRole('button', { name: 'Tạo đơn và chọn thanh toán', exact: true }).isDisabled(), 'Unapplied checkout code blocks order');
            let previewResponse = responseFor('/promotion-preview', 'POST');
            await page.getByRole('button', { name: 'Áp dụng mã', exact: true }).click();
            check((await previewResponse).status() === 409, 'Invalid checkout code rejected');
            await page.getByRole('button', { name: 'Hủy thay đổi mã', exact: true }).click();
            await page.getByRole('combobox', { name: 'Mã khuyến mãi', exact: true }).fill('SALE10');
            previewResponse = responseFor('/promotion-preview', 'POST');
            await page.getByRole('button', { name: 'Áp dụng mã', exact: true }).click();
            check((await previewResponse).status() === 200, 'Checkout code quoted');
            await page.waitForFunction(() => document.querySelector('.summaryTotal strong')?.textContent === '206.100₫');
            await page.locator('#online-member-points').fill('20');
            await page.waitForFunction(() => document.querySelector('.summaryTotal strong')?.textContent === '186.100₫');
            await page.getByRole('combobox', { name: 'Mã khuyến mãi', exact: true }).fill('ONLY30K');
            previewResponse = responseFor('/promotion-preview', 'POST');
            await page.getByRole('button', { name: 'Bỏ điểm và áp dụng mã', exact: true }).click();
            check((await previewResponse).status() === 200, 'Checkout explicitly replaces points with an exclusive code');
            await page.waitForFunction(() => document.querySelector('.summaryTotal strong')?.textContent === '199.000₫');
            check(await page.locator('#online-member-points').count() === 0, 'Exclusive code prevents adding points');
            await page.getByRole('button', { name: 'Bỏ mã khuyến mãi', exact: true }).click();
            check(await page.locator('#online-member-points').inputValue() === '0', 'Replacing points keeps zero after removing code');
            await page.getByRole('combobox', { name: 'Mã khuyến mãi', exact: true }).fill('SALE10');
            previewResponse = responseFor('/promotion-preview', 'POST');
            await page.getByRole('button', { name: 'Áp dụng mã', exact: true }).click();
            await previewResponse;
            await page.waitForFunction(() => document.querySelector('.summaryTotal strong')?.textContent === '206.100₫');
            check(await Booking.countDocuments() === 0, 'Preview does not create an order');
            assert.deepEqual((await Showtime.findOne()).seats.map(s => s.status), beforeSeats, 'Preview does not hold seats');
            check((await Promotion.findById(sale.id)).usedCount === 0, 'Preview does not consume a code');
            await page.locator('.counterPromotion').screenshot({ path: path.join(artifacts, 'checkout-promotion.png') });
            await page.setViewportSize({ width: 390, height: 844 });
            check(await page.locator('.counterPromotion').evaluate(el => el.scrollWidth <= el.clientWidth), 'Checkout promotion fits mobile');
            await page.locator('.counterPromotion').screenshot({ path: path.join(artifacts, 'checkout-promotion-mobile.png') });
            await page.setViewportSize({ width: 1440, height: 1000 });
            const response = responseFor('/bookings', 'POST');
            await page.getByRole('button', { name: 'Tạo đơn và chọn thanh toán', exact: true }).click();
            const created = await response;
            const order = await created.json();
            check(created.status() === 201 && order.promotion.code === 'SALE10', 'Checkout promotion persists into order');
            await total(206100);
            const removed = responseFor('/promotion');
            await page.getByRole('button', { name: 'Bỏ mã khuyến mãi', exact: true }).click();
            await removed; await total(229000);
            return order;
        }
        const response = responseFor('/bookings', 'POST'); await page.getByRole('button', { name: 'Tạo đơn và chọn thanh toán', exact: true }).click();
        const created = await response; check(created.status() === 201, 'Member creates online order'); await total(229000); return created.json();
    }
    async function apply(code, status = 200) {
        await page.getByRole('combobox', { name: 'Mã khuyến mãi', exact: true }).fill(code);
        const response = responseFor('/promotion'); await page.locator('.counterPromotion').getByRole('button', { name: /áp dụng mã|kiểm tra lại mã/i }).click();
        const result = await response; check(result.status() === status, 'Code ' + code + ' status ' + status); return result.json();
    }
    async function points(value) {
        await page.locator('#paymentPoints').fill(String(value)); const response = responseFor('/points');
        await page.getByRole('button', { name: 'Áp dụng điểm', exact: true }).click(); check((await response).status() === 200, 'Apply ' + value + ' points');
    }
    async function remove() { const response = responseFor('/promotion'); await page.getByRole('button', { name: 'Bỏ mã khuyến mãi', exact: true }).click(); check((await response).status() === 200, 'Remove promotion'); }

    stage = 'online promotion input, invalid draft and suggestions';
    const booking = await createOrder();
    await page.getByRole('heading', { name: 'Mã khuyến mãi', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('#counter-promotion-options option').length === 4);
    check(await page.locator('.counterPromotion button[type=submit]').isDisabled(), 'Empty code cannot submit');
    await apply('UNKNOWN', 409); check(await page.locator('.paymentSubmit').isDisabled(), 'Unapplied code blocks payment');
    await page.getByRole('button', { name: 'Hủy thay đổi mã', exact: true }).click();

    stage = 'simultaneous point and promotion drafts never lock each other';
    await page.locator('#paymentPoints').fill('10');
    await page.getByRole('combobox', { name: 'Mã khuyến mãi', exact: true }).fill('SALE10');
    check(await page.locator('#paymentPoints').isEnabled() && await page.locator('#counter-promotion-code').isEnabled(), 'Both draft inputs stay editable');
    check(await page.getByRole('button', { name: 'Áp dụng điểm', exact: true }).isEnabled(), 'Point draft can be applied with a pending code');
    await apply('SALE10'); await total(206100);
    check(await page.locator('#paymentPoints').inputValue() === '10', 'Applying code preserves unsaved points');
    check(await page.locator('.paymentSubmit').isDisabled(), 'Unapplied points still block payment');
    await points(10); await total(196100);
    await page.locator('#paymentPoints').fill('20');
    await page.getByRole('combobox', { name: 'Mã khuyến mãi', exact: true }).fill('FOOD20');
    await points(20); await total(186100);
    check(await page.locator('#counter-promotion-code').inputValue() === 'FOOD20', 'Applying points preserves unsaved code');
    await apply('FOOD20'); await total(195200);
    await page.locator('#paymentPoints').fill('');
    check(await page.locator('.paymentSubmit').isDisabled(), 'Empty point draft is not treated as saved zero');
    await page.getByRole('button', { name: 'Hủy thay đổi điểm', exact: true }).click();
    check(await page.locator('#paymentPoints').inputValue() === '20', 'Cancel restores accepted points');
    await points(0); await remove(); await total(229000);

    stage = 'promotion and applied-point interaction';
    await apply(' sale10 '); await total(206100); await points(20); await total(186100);
    check((await Promotion.findById(sale.id)).usedCount === 0, 'Quotes do not consume usage');
    await remove(); await total(209000);
    await page.getByRole('combobox', { name: 'Mã khuyến mãi', exact: true }).fill('ONLY30K');
    check(await page.getByRole('button', { name: 'Bỏ dùng điểm', exact: true }).isEnabled(), 'Pending code does not prevent removing points');
    await page.getByRole('button', { name: 'Bỏ điểm và áp dụng mã', exact: true }).waitFor();
    await page.locator('.counterPromotion').screenshot({ path: path.join(artifacts, 'exclusive-code-choice.png') });
    await apply('ONLY30K'); await total(199000);
    check(await page.locator('#paymentPoints').inputValue() === '0' && (await User.findById(member.id)).memberPoints === 20, 'Explicit exclusive-code action removes redemption while preserving wallet');
    check(await page.locator('#paymentPoints').isDisabled(), 'Exclusive code disables point redemption');
    await remove(); await apply('FOOD20'); await total(215200);

    stage = 'food edits recalculate the promotion';
    await page.getByRole('button', { name: 'Đổi bắp nước', exact: true }).click(); await page.locator('.foodQuantity input').fill('2');
    let foodResponse = responseFor('/food'); await page.getByRole('button', { name: 'Lưu món và cập nhật tổng tiền', exact: true }).click(); check((await foodResponse).status() === 200, 'Food edit accepted'); await total(270400);
    await page.getByRole('button', { name: 'Đổi bắp nước', exact: true }).click(); await page.locator('.foodQuantity input').fill('0');
    foodResponse = responseFor('/food'); await page.getByRole('button', { name: 'Lưu món và cập nhật tổng tiền', exact: true }).click(); check((await foodResponse).status() === 409, 'Food-only code rejects removing all food');
    await page.getByRole('button', { name: 'Hủy chỉnh sửa', exact: true }).click();
    await page.getByRole('button', { name: 'Đổi bắp nước', exact: true }).click(); await page.locator('.foodQuantity input').fill('1');
    foodResponse = responseFor('/food'); await page.getByRole('button', { name: 'Lưu món và cập nhật tổng tiền', exact: true }).click(); await foodResponse; await total(215200);
    await apply('SALE10'); await points(20); await total(186100);
    await page.locator('.counterPromotion').screenshot({ path: path.join(artifacts, 'desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    check(await page.locator('.counterPromotion').evaluate(el => el.scrollWidth <= el.clientWidth), 'Promotion controls fit mobile');
    await page.locator('.counterPromotion').screenshot({ path: path.join(artifacts, 'mobile.png') }); await page.setViewportSize({ width: 1440, height: 1000 });

    stage = 'VNPay receives the promotion and points discounted amount';
    await page.route('https://sandbox.vnpayment.vn/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Gateway intercepted by test</p>' }));
    await page.locator('.paymentSubmit').click(); await page.waitForURL('https://sandbox.vnpayment.vn/**');
    const url = new URL(page.url()); check(url.searchParams.get('vnp_Amount') === '18610000', 'VNPay total is 186,100 VND');
    const params = { vnp_TmnCode: process.env.VNPAY_TMN_CODE, vnp_TxnRef: url.searchParams.get('vnp_TxnRef'), vnp_Amount: '18610000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: '123456789' };
    params.vnp_SecureHash = signature(params);
    const callback = base + '/api/payments/vnpay/ipn?' + new URLSearchParams(params);
    check((await (await page.request.get(callback)).json()).RspCode === '00', 'Signed test callback settles order');
    check((await (await page.request.get(callback)).json()).RspCode === '02', 'Callback retry does not redeem twice');
    check((await Promotion.findById(sale.id)).usedCount === 1 && (await Promotion.findById(foodCode.id)).usedCount === 0, 'Only the paid code consumes usage');
    check((await Booking.findById(booking._id)).total === 186100 && (await User.findById(member.id)).memberPoints === 0, 'Server saves discounted total and point debit');
    await page.goto(base + '/payment-result?reference=' + params.vnp_TxnRef); await page.getByRole('heading', { name: 'Thanh toán thành công!' }).waitFor();

    stage = '100% promotion confirms an online zero-total order';
    await page.goto(base + '/account'); const zeroOrder = await createOrder(); await apply('FREE100'); await total(0);
    const paidResponse = responseFor('/pay', 'POST'); await page.getByRole('button', { name: 'Xác nhận đơn 0đ', exact: true }).click();
    const paid = await paidResponse; check(paid.status() === 200 && (await paid.json()).status === 'paid', 'Zero-total promotion issues tickets');
    check((await Promotion.findById(free.id)).usedCount === 1, 'Free code consumed once');
    check(await PaymentAttempt.countDocuments({ booking: zeroOrder._id, method: { $in: ['cash','vnpay'] } }) === 0, 'No cash or gateway for zero total');
    check(errors.length === 0, 'No browser runtime errors: ' + errors.join('; '));
    console.log(`PASS: ${checks} checks; online code suggestions/apply/remove, invalid drafts, points stacking, food repricing, mobile, VNPay and zero total.`);
} catch (error) {
    console.error('Online promotions UI failed at: ' + stage);
    if (page) await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
} finally {
    if (browser) await browser.close(); if (vite) await vite.close(); if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
}
