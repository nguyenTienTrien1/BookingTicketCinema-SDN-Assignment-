import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import mongoose from 'mongoose';
import { chromium } from 'playwright';
import User from '../../src/models/users/User.js';
import Movie from '../../src/models/movies/Movie.js';
import Showtime from '../../src/models/cinema/Showtime.js';
import CinemaRoom from '../../src/models/cinema/CinemaRoom.js';

// Run Expo first: npm run dev:mobile -- --go --lan
// The UI uses the live Expo preview; all API requests go to this isolated database.
const base = process.env.MOBILE_UI_URL || 'http://localhost:8081';
const dbName = 'cinema_mobile_showtimes_' + randomUUID().replaceAll('-', '');
const password = randomUUID();
const artifacts = '../.local/qa/mobile-showtimes';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'mobile-showtime-test-' + randomUUID();
process.env.MOBILE_WEB_ORIGIN = base;
let server, browser, page;
await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
try {
  await User.init();
  await User.create({ fullName: 'Mobile Admin', email: 'admin@mobile-showtimes.test', password, role: 'admin', status: 'Active' });
  await User.create({ fullName: 'Mobile Employee', email: 'employee@mobile-showtimes.test', password, role: 'employee', status: 'Active' });
  const [movie, other] = await Movie.create([
    { title: 'Mobile Schedule Test', duration: 90, classification: 'P', releaseDate: new Date('2020-01-01') },
    { title: 'Another Movie', duration: 100, classification: 'P' },
  ]);
  const room = await CinemaRoom.create({ cinema: 'Mobile Cinema', name: 'Room 1', status: 'Active', seats: ['A1', 'A2', 'B1'] });
  const start = Date.now() + 86400000;
  await Showtime.insertMany(Array.from({ length: 11 }, (_, index) => ({
    movie: index % 2 ? other._id : movie._id, cinema: room.cinema, room: room.name, roomId: room._id,
    startTime: new Date(start + index * 3 * 3600000), price: 80000,
    seats: room.seats.map(number => ({ number, status: 'available', condition: 'Active' })),
  })));
  const { default: app } = await import('../../src/app.js');
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const apiBase = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/New_York' });
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: apiBase + url.pathname + url.search });
    await route.fulfill({ response });
  });
  page = await context.newPage(); page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await mkdir(artifacts, { recursive: true });
  async function click(name) { await page.getByRole('button', { name, exact: true }).click(); }
  async function login(email) {
    await page.goto(base);
    await click('Nhân viên / Admin');
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
    await page.getByRole('textbox', { name: 'Mật khẩu', exact: true }).fill(password);
    await click('Đăng nhập');
    await page.waitForURL(/\/workspace$/);
  }
  async function choose(title, name) {
    await click(title);
    await page.getByRole('button', { name: new RegExp(name) }).last().click();
  }
  async function visible(text) { await page.getByText(text, { exact: true }).first().waitFor(); }
  await login('admin@mobile-showtimes.test');
  await click('Quản lý suất chiếu');
  await visible('11 suất chiếu · Trang 1/2');
  await click('Trang sau'); await visible('11 suất chiếu · Trang 2/2');
  await choose('Lọc theo phim', 'Mobile Schedule Test'); await visible('6 suất chiếu · Trang 1/1');
  await click('Thêm suất chiếu');
  await click('Lưu suất chiếu'); await visible('Vui lòng chọn phim.');
  await choose('Phim', 'Mobile Schedule Test');
  await choose('Rạp / Phòng chiếu', 'Mobile Cinema');
  const time = new Date(Date.now() + 8 * 86400000);
  time.setUTCHours(3, 0, 0, 0);
  const vietnamTime = new Date(time.getTime() + 7 * 3600000).toISOString().slice(0, 16);
  await page.getByRole('textbox', { name: 'Ngày giờ bắt đầu (UTC+7)', exact: true }).fill(vietnamTime);
  await page.getByRole('textbox', { name: 'Giá vé (VND)', exact: true }).fill('0');
  await click('Lưu suất chiếu'); await visible('Giá vé phải là số nguyên dương (VND).');
  await page.getByRole('textbox', { name: 'Giá vé (VND)', exact: true }).fill('95000');
  await page.screenshot({ path: `${artifacts}/create-mobile.png`, fullPage: true });
  await click('Lưu suất chiếu'); await visible('Thêm suất chiếu thành công.');
  let created = await Showtime.findOne({ startTime: time });
  assert.ok(created); assert.equal(created.price, 95000); assert.equal(created.seats.length, 3);
  assert.equal(created.startTime.toISOString(), time.toISOString(), 'Vietnam time must not use device timezone');

  // New show is last on page 2; editing loads the latest version from the API.
  await click('Trang sau');
  await page.getByRole('button', { name: /^Sửa suất chiếu Mobile Schedule Test/ }).last().click();
  await page.getByRole('textbox', { name: 'Giá vé (VND)', exact: true }).fill('99000');
  await click('Lưu thay đổi'); await visible('Cập nhật suất chiếu thành công.');
  created = await Showtime.findById(created._id); assert.equal(created.price, 99000);

  // Overlap errors keep the form visible without creating a second show.
  await click('Thêm suất chiếu');
  await choose('Phim', 'Mobile Schedule Test'); await choose('Rạp / Phòng chiếu', 'Mobile Cinema');
  await page.getByRole('textbox', { name: 'Ngày giờ bắt đầu (UTC+7)', exact: true }).fill(vietnamTime);
  await click('Lưu suất chiếu');
  await visible('Phòng đã có suất chiếu trùng lịch, gồm 15 phút dọn phòng.');
  assert.equal(await Showtime.countDocuments(), 12);
  await click('Về danh sách suất chiếu'); await click('Trang sau');
  await page.getByRole('button', { name: /^Sửa suất chiếu Mobile Schedule Test/ }).last().click();
  await page.getByRole('textbox', { name: 'Giá vé (VND)', exact: true }).fill('101000');
  await Showtime.updateOne({ _id: created._id }, { $set: { price: 100000, updatedAt: new Date(Date.now() + 1000) } });
  await click('Lưu thay đổi'); await page.getByRole('button', { name: 'Tải lại suất chiếu', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).isDisabled(), true);
  await click('Tải lại suất chiếu');
  await page.waitForFunction(() => document.querySelector('input[aria-label="Giá vé (VND)"]')?.value === '100000');
  await click('Về danh sách suất chiếu'); await click('Trang sau');
  await page.getByRole('button', { name: 'Xóa suất chiếu', exact: true }).last().click();
  await click('Quay lại'); assert.ok(await Showtime.findById(created._id), 'Cancel deletion leaves data unchanged');
  await page.getByRole('button', { name: 'Xóa suất chiếu', exact: true }).last().click();
  await click('Xác nhận thực hiện'); await visible('Xóa suất chiếu thành công.');
  assert.equal(await Showtime.findById(created._id), null);
  await page.screenshot({ path: `${artifacts}/list-mobile.png`, fullPage: true });
  assert.deepEqual(errors, []);

  // A new browser load has no in-memory token; protected routes must redirect.
  await page.goto(base + '/showtimes/edit'); await page.waitForURL(base + '/');
  await login('employee@mobile-showtimes.test');
  assert.equal(await page.getByRole('button', { name: 'Quản lý suất chiếu', exact: true }).count(), 0);
  console.log('Mobile showtimes: login, navigation, pagination/filter, validation, create/edit/delete, overlap, stale recovery and access checks passed.');
} catch (error) {
  if (page) await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  assert.equal(mongoose.connection.name, dbName);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
