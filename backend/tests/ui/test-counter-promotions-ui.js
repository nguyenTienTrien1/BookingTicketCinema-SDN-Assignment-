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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const artifacts = path.join(root, '.local', 'qa', 'uc92');
const dbName = 'cinema_uc92_browser_' + randomUUID().replaceAll('-', '');
const password = randomUUID(), money = value => value.toLocaleString('vi-VN') + 'đ';
let server, vite, browser, page, checks = 0, stage = 'setup';
const check = (value, message) => { assert.ok(value, message); checks++; };
process.env.NODE_ENV = 'test'; process.env.POINT_REDEEM_STEP = '100';
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
try {
  await Promise.all([User.init(), Promotion.init(), Booking.init()]);
  const employee = await User.create({ fullName: 'UC92 Employee', email: 'employee@uc92.test', password, role: 'employee', status: 'Active' });
  const member = await User.create({ fullName: 'UC92 Member', email: 'member@uc92.test', password, role: 'member', status: 'Active', memberPoints: 1000 });
  const movie = await Movie.create({ title: 'UC92 Movie', genre: ['Action'], duration: 90, classification: 'P' });
  await Showtime.create({ movie: movie.id, cinema: 'UC92 Cinema', room: 'Room 1', price: 200000, startTime: new Date(Date.now() + 3600000), seats: ['A1', 'A2', 'A3', 'A4'].map(number => ({ number })) });
  const food = await Food.create({ name: 'Popcorn', price: 25000, stock: 20, available: true });
  const common = { startsAt: new Date(Date.now() - 3600000), endsAt: new Date(Date.now() + 3600000), active: true, usageLimit: 10 };
  const discount = await Promotion.create({ ...common, code: 'FOOD10', name: 'Giảm 10% bắp nước', discountType: 'percentage', value: 10, scope: 'food', minOrder: 50000, stackable: true });
  const exclusive = await Promotion.create({ ...common, code: 'ONLY20', name: 'Ưu đãi riêng 20%', discountType: 'percentage', value: 20, scope: 'all', minOrder: 0, stackable: false });
  const free = await Promotion.create({ ...common, code: 'FREE100', name: 'Miễn phí đơn vé', discountType: 'percentage', value: 100, scope: 'all', minOrder: 0, stackable: false });
  const { default: app } = await import("../../src/app.js");
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  vite = await createServer({ root: path.join(root, 'frontend'), configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api'), 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') },
    server: { host: '127.0.0.1', port: 0, open: false, proxy: { '/api': `http://127.0.0.1:${server.address().port}` } } });
  await vite.listen(); const base = `http://127.0.0.1:${vite.httpServer.address().port}`; process.env.CORS_ORIGIN = base;
  browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
  const errors = [];
  async function login(role) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const p = await context.newPage(); p.setDefaultTimeout(12000); p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + (role === 'member' ? '/login' : '/admin/login')); await p.locator('#cinema-email').fill(role + '@uc92.test'); await p.locator('#cinema-password').fill(password);
    await p.locator('.cinemaAuthForm button[type=submit]').click(); await p.waitForURL(base + (role === 'member' ? '/' : role === 'admin' ? '/admin/dashboard' : '/employee/dashboard')); await p.goto(base + '/account'); return p;
  }
  page = await login('employee'); await mkdir(artifacts, { recursive: true });
  const waitResponse = (suffix, method = 'PATCH') => page.waitForResponse(r => new URL(r.url()).pathname.endsWith(suffix) && r.request().method() === method);
  async function total(amount) { await page.locator('.receiptTotal strong').filter({ hasText: money(amount) }).waitFor(); check(await page.locator('.receiptTotal strong').textContent() === money(amount), 'Confirmed total is ' + amount); }
  async function startSale(seat, customer, quantity) {
    await page.locator('.employeeTaskNav, .paymentBack').first().waitFor();
    if (await page.locator('.employeeTaskNav').count()) await page.getByRole('button', { name: 'Bán vé tại quầy', exact: true }).click();
    else await page.getByRole('button', { name: 'Về quầy vé', exact: true }).click();
    await page.getByRole('button', { name: 'UC92 Cinema', exact: true }).click();
    await page.locator('.showtimeBtn').first().click(); await page.getByRole('button', { name: new RegExp('^' + seat + ',') }).click();
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    if (customer === 'member') {
      await page.locator('input[name=counterCustomerType][value=member]').check();
      await page.getByLabel('Email hoặc số điện thoại thành viên', { exact: true }).fill('member@uc92.test');
      await page.getByRole('button', { name: 'Tìm thành viên', exact: true }).click();
      await page.getByRole('button', { name: /UC92 Member · member@uc92.test/ }).click();
      await page.locator('input[placeholder="Họ tên khách hàng"]').waitFor();
      await page.waitForFunction(() => document.querySelector('input[placeholder="Họ tên khách hàng"]')?.value === 'UC92 Member');
    }
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    if (quantity) await page.locator('.foodQuantity input').fill(String(quantity));
    const response = waitResponse('/counter/bookings', 'POST');
    await page.getByRole('button', { name: 'Giữ ghế & tiếp tục thanh toán', exact: true }).click();
    const r = await response; check(r.status() === 201, 'Counter order created through the real UI');
    const booking = await r.json(); await page.getByRole('heading', { name: 'Xác nhận đơn vé', exact: true }).waitFor(); return booking;
  }
  async function apply(code, status = 200) {
    await page.getByLabel('Mã khuyến mãi', { exact: true }).fill(code);
    const response = waitResponse('/promotion');
    await page.locator('.counterPromotion').getByRole('button', { name: /Áp dụng mã|Kiểm tra lại mã/ }).click();
    const r = await response; check(r.status() === status, 'Promotion result status ' + status); return r.json();
  }
  stage = 'counter creation and applying a promotion';
  const booking = await startSale('A1', 'member', 2); await total(250000);
  await apply('food10'); await total(245000);
  check((await Promotion.findById(discount.id)).usedCount === 0, 'Applying a code does not consume usage');
  check((await Food.findById(food.id)).stock === 20, 'Quoting food does not consume inventory');
  const received = page.locator('.receivedLabel input'); await received.fill('245000');
  await apply('UNKNOWN', 409); await page.getByRole('alert').waitFor();
  check(await page.locator('.paymentSubmit').isDisabled(), 'Unapplied or invalid draft cannot be paid');
  await page.getByRole('button', { name: 'Hủy thay đổi mã', exact: true }).click();
  await total(245000);
  await apply(exclusive.code); await total(200000);
  check(await page.locator('#paymentPoints').isDisabled(), 'Non-stackable code disables points');
  const removed = waitResponse('/promotion'); await page.getByRole('button', { name: 'Bỏ mã khuyến mãi', exact: true }).click(); await removed; await total(250000);
  await apply(discount.code); await total(245000);
  await page.locator('#paymentPoints').fill('100');
  const pointResponse = waitResponse('/points'); await page.getByRole('button', { name: 'Áp dụng điểm', exact: true }).click(); await pointResponse; await total(145000);
  stage = 'food edit, minimum failure and accepted total';
  await received.fill('145000'); await page.getByRole('button', { name: 'Đổi bắp nước', exact: true }).click();
  await page.locator('.foodQuantity input').fill('3');
  const foodResponse = waitResponse('/food'); await page.getByRole('button', { name: 'Lưu món và cập nhật tổng tiền', exact: true }).click(); await foodResponse; await total(167500);
  check(await received.inputValue() === '', 'Changed totals require a fresh cash confirmation');
  await page.getByRole('button', { name: 'Đổi bắp nước', exact: true }).click(); await page.locator('.foodQuantity input').fill('1');
  const failedFood = waitResponse('/food'); await page.getByRole('button', { name: 'Lưu món và cập nhật tổng tiền', exact: true }).click();
  check((await failedFood).status() === 409, 'A food edit below the scoped minimum is rejected');
  check((await Booking.findById(booking._id)).foodItems[0].quantity === 3, 'Failed edit preserves the accepted items');
  await page.getByRole('button', { name: 'Hủy chỉnh sửa', exact: true }).click();
  stage = 'settlement revalidation and mobile checkout';
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'counter-promotion-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Promotion checkout fits mobile');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'counter-promotion-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const originalEnd = (await Promotion.findById(discount.id)).endsAt;
  await Promotion.updateOne({ _id: discount.id }, { $set: { endsAt: new Date(Date.now() - 1000) }, $inc: { __v: 1 } });
  await received.fill('167500'); const failedPay = waitResponse('/pay', 'POST'); await page.locator('.paymentSubmit').click();
  check((await failedPay).status() === 200, 'Expired code returns the collected payment to Member points');
  check((await Food.findById(food.id)).stock === 20 && (await User.findById(member.id)).memberPoints === 1167.5, 'Failed settlement preserves stock and credits only the collected amount');
  const refunded = await Booking.findById(booking._id);
  check(refunded.status === 'refunded' && !refunded.activePayment && refunded.refund.points === 167.5 && refunded.tickets.length === 0, 'Refunded receipt remains traceable without issuing tickets');
  check((await Promotion.findById(discount.id)).usedCount === 0, 'Failed settlement does not consume the promotion');
  await Promotion.updateOne({ _id: discount.id }, { $set: { endsAt: originalEnd }, $inc: { __v: 1 } });
  await startSale('A1', 'member', 3); await apply(discount.code);
  await page.locator('#paymentPoints').fill('100');
  const reappliedPoints = waitResponse('/points'); await page.getByRole('button', { name: 'Áp dụng điểm', exact: true }).click(); await reappliedPoints;
  await total(167500); await page.locator('.receivedLabel input').fill('167500');
  const paidResponse = waitResponse('/pay', 'POST'); await page.locator('.paymentSubmit').click();
  check((await paidResponse).status() === 200, 'New order settles against the restored promotion rules');
  await page.getByRole('heading', { name: 'Đã hoàn tất đơn', exact: true }).waitFor();
  check(await page.locator('.ticketGrid img').count() === 1, 'Paid counter sale displays its QR');
  check((await Promotion.findById(discount.id)).usedCount === 1 && (await Food.findById(food.id)).stock === 17, 'Settlement consumes promotion and food exactly once');
  check((await User.findById(member.id)).memberPoints === 1067.5, 'Confirmed settlement deducts selected points while preserving the prior refund');
  check(await page.locator('#counter-promotion-code').count() === 0, 'Paid promotions are read-only');
  stage = 'guest order fully covered by promotion';
  const guestBooking = await startSale('A2', 'guest', 0); await apply(free.code); await total(0);
  check(await page.locator('.receivedLabel input').count() === 0, 'Zero-total guest order does not request cash');
  const freeResponse = waitResponse('/pay', 'POST'); await page.getByRole('button', { name: 'Xác nhận đơn 0đ', exact: true }).click();
  check((await freeResponse).status() === 200, 'Zero-total promotion finalizes without cash');
  await page.getByRole('heading', { name: 'Đã hoàn tất đơn', exact: true }).waitFor();
  check((await Promotion.findById(free.id)).usedCount === 1 && (await Booking.findById(guestBooking._id)).user === null, 'Guest redemption keeps anonymous ownership');
  stage = 'Member history keeps the accepted promotion snapshot';
  const memberPage = await login('member'); await memberPage.goto(base + '/bookings');
  await memberPage.locator('.historyPaymentDetails').filter({ hasText: 'Khuyến mãi (FOOD10)' }).first().locator('summary').click();
  await memberPage.getByText('Khuyến mãi (FOOD10)', { exact: true }).first().waitFor();
  await memberPage.getByRole('link', { name: /Xem vé QR/ }).click(); await memberPage.getByRole('img', { name: /QR vé ghế/ }).waitFor();
  check(errors.length === 0, 'No browser runtime errors: ' + errors.join('; '));
  console.log(JSON.stringify({ result: 'passed', checks, artifacts, actualApiAndDatabase: true }));
} catch (error) {
  console.error('UC9.2 browser check failed at: ' + stage);
  if (page) { console.error((await page.locator('body').innerText()).slice(-2200)); await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }); }
  throw error;
} finally {
  if (browser) await browser.close(); if (vite) await vite.close(); if (server) await new Promise(resolve => server.close(resolve));
  assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
}
