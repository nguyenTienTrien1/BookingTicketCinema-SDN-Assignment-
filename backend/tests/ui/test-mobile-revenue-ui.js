import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import mongoose from 'mongoose';
import { chromium } from 'playwright';
import User from '../../src/models/users/User.js';
import RevenueEntry from '../../src/models/revenue/RevenueEntry.js';
import FoodSale from '../../src/models/catalogue/FoodSale.js';

// Requires the Expo preview at MOBILE_UI_URL. API calls use an isolated database.
const base = process.env.MOBILE_UI_URL || 'http://localhost:8081';
const dbName = 'cinema_mobile_revenue_' + randomUUID().replaceAll('-', '');
const password = randomUUID(), artifacts = '../.local/qa/mobile-revenue';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'mobile-revenue-test-' + randomUUID();
process.env.MOBILE_WEB_ORIGIN = base;
let server, browser, page;
await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
try {
  await User.init(); await RevenueEntry.init();
  await User.create({ fullName: 'Revenue Admin', email: 'admin@mobile-revenue.test', password, role: 'admin', status: 'Active' });
  const employee = await User.create({ fullName: 'Revenue Employee', email: 'employee@mobile-revenue.test', password, role: 'employee', status: 'Active' });
  const booking = () => new mongoose.Types.ObjectId();
  const oldBooking = booking();
  await RevenueEntry.create([
    { booking: booking(), reference: 'CASH', kind: 'payment', method: 'cash', evidence: 'employee-receipt', confirmedAt: '2020-01-01T03:00:00Z', gross: 100000, discounts: 10000, amount: 90000 },
    { booking: booking(), reference: 'VNPAY', kind: 'payment', method: 'vnpay', evidence: 'provider-confirmation', confirmedAt: '2020-01-02T03:00:00Z', gross: 200000, amount: 200000 },
    { booking: oldBooking, reference: 'OLD', kind: 'payment', method: 'cash', evidence: 'employee-receipt', confirmedAt: '2019-12-20T03:00:00Z', gross: 50000, amount: 50000 },
    { booking: oldBooking, reference: 'REFUND', originalReference: 'OLD', kind: 'refund', method: 'cash', evidence: 'employee-receipt', confirmedAt: '2020-01-03T03:00:00Z', amount: 50000 },
  ]);
  await FoodSale.create({ employee: employee._id, requestId: randomUUID(), items: [{ food: booking(), name: 'Popcorn', unitPrice: 30000, quantity: 2 }],
    total: 60000, currency: 'VND', status: 'paid', paymentMethod: 'cash', cashReceived: 100000, change: 40000,
    paymentConfirmedAt: new Date('2020-01-01T09:00:00Z'), paidAt: new Date('2020-01-01T10:00:00Z') });
  const { default: app } = await import('../../src/app.js');
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const apiBase = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/New_York' });
  let failNext = false;
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (failNext && url.pathname === '/api/revenue/reports') {
      failNext = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Báo cáo tạm thời không khả dụng.' }) }); return;
    }
    const response = await route.fetch({ url: apiBase + url.pathname + url.search });
    await route.fulfill({ response });
  });
  page = await context.newPage(); page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await mkdir(artifacts, { recursive: true });
  const click = name => page.getByRole('button', { name, exact: true }).click();
  const visible = text => page.getByText(text, { exact: true }).first().waitFor();
  async function login(email) {
    await page.goto(base); await click('Nhân viên / Admin');
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
    await page.getByRole('textbox', { name: 'Mật khẩu', exact: true }).fill(password);
    await click('Đăng nhập'); await page.waitForURL(/\/workspace$/);
  }
  async function choose(title, name) { await click(title); await page.getByRole('button', { name, exact: true }).last().click(); }
  async function total(value) { await page.getByLabel(`Thu ròng: ${value} ₫`, { exact: true }).waitFor(); }
  await login('admin@mobile-revenue.test'); await click('Xem doanh thu');
  await visible('Chưa có giao dịch được xác minh trong kỳ'); await total('0');
  await page.getByRole('textbox', { name: 'Từ ngày', exact: true }).fill('2020-01-01');
  await page.getByRole('textbox', { name: 'Đến ngày', exact: true }).fill('2020-01-20');
  await visible('Bộ lọc chưa áp dụng. Bấm Xem báo cáo để cập nhật; số liệu bên dưới vẫn thuộc bộ lọc đã áp dụng.');
  await total('0'); await click('Xem báo cáo'); await total('300.000');
  await visible('3 thanh toán · 1 hoàn tiền');
  await visible('Xu hướng thu ròng');
  await click('Kỳ sau'); await visible('Trang 2/2');
  await click('Kỳ trước'); await visible('Trang 1/2');
  await click('03/01/2020'); await page.getByText('-50.000 ₫', { exact: true }).first().waitFor();
  await page.screenshot({ path: `${artifacts}/revenue-mobile.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal page overflow');
  await choose('Nguồn thu', 'F&B tại quầy'); await total('300.000');
  await click('Xem báo cáo'); await total('60.000');
  await choose('Phương thức thanh toán', 'VNPay'); await click('Xem báo cáo'); await total('0');
  await choose('Nguồn thu', 'Vé và F&B đi kèm'); await click('Xem báo cáo'); await total('200.000');
  await choose('Nguồn thu', 'Tất cả nguồn'); await choose('Phương thức thanh toán', 'Tất cả phương thức');
  await click('Theo tháng'); await click('Xem báo cáo'); await total('300.000'); await visible('01/2020');
  await page.getByRole('textbox', { name: 'Đến ngày', exact: true }).fill('2019-12-31');
  await click('Xem báo cáo'); await visible('Ngày kết thúc phải từ ngày bắt đầu; khoảng báo cáo tối đa 366 ngày.');
  assert.equal(await page.getByLabel('Thu ròng: 300.000 ₫', { exact: true }).count(), 0, 'failed request clears old totals');
  await page.getByRole('textbox', { name: 'Đến ngày', exact: true }).fill('2020-01-20');
  failNext = true; await click('Xem báo cáo'); await visible('Báo cáo tạm thời không khả dụng.');
  await click('Xem báo cáo'); await total('300.000');
  assert.deepEqual(errors, []);
  await page.goto(base + '/revenue'); await page.waitForURL(base + '/');
  await login('employee@mobile-revenue.test');
  assert.equal(await page.getByRole('button', { name: 'Xem doanh thu', exact: true }).count(), 0);
  console.log('Mobile revenue: Admin navigation, real totals, negative refund period, source/method/date filters, pagination, empty state, failures/retry and access checks passed.');
} catch (error) {
  if (page) await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  assert.equal(mongoose.connection.name, dbName);
  await mongoose.connection.dropDatabase(); await mongoose.disconnect();
}
