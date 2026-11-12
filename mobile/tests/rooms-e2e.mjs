import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, 'backend/.env') });
process.env.NODE_ENV = 'test';
const artifacts = path.join(root, '.local/qa/mobile-rooms');
const dbName = 'cinema_mobile_rooms_' + randomUUID().replaceAll('-', '');
let apiServer, webServer, browser, page, stage = 'setup';
let checks = 0;
const check = (value, description) => { assert.ok(value, description); checks++; };
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });

try {
  const { default: User } = await import('../../backend/src/models/users/User.js');
  const { default: Room } = await import('../../backend/src/models/cinema/CinemaRoom.js');
  const { default: Movie } = await import('../../backend/src/models/movies/Movie.js');
  const { default: Showtime } = await import('../../backend/src/models/cinema/Showtime.js');
  const { default: Booking } = await import('../../backend/src/models/bookings/Booking.js');
  const { default: app } = await import('../../backend/src/app.js');
  const password = randomUUID();
  const admin = await User.create({ fullName: 'Mobile Rooms Admin', email: 'admin@mobile-rooms.test', password, role: 'admin', status: 'Active' });
  const member = await User.create({ fullName: 'Mobile Rooms Member', email: 'member@mobile-rooms.test', password, role: 'member', status: 'Active' });
  await User.create({ fullName: 'Mobile Rooms Employee', email: 'employee@mobile-rooms.test', password, role: 'employee', status: 'Active' });
  await Room.init();
  await Room.create({ cinema: 'Other Cinema', name: 'Other Room', status: 'Maintenance', seats: Array.from({ length: 10 }, (_, row) => Array.from({ length: 16 }, (_, col) => String.fromCharCode(65 + row) + (col + 1))).flat(), seatConfigs: { D1: { type: 'Standard', status: 'Broken' } } });
  apiServer = app.listen(0, '127.0.0.1'); await once(apiServer, 'listening');
  const apiBase = `http://127.0.0.1:${apiServer.address().port}`;
  const web = express();
  web.use(express.static(path.join(artifacts, 'web')));
  web.get('*', (_req, res) => res.sendFile(path.join(artifacts, 'web/index.html')));
  webServer = web.listen(0, '127.0.0.1'); await once(webServer, 'listening');
  const base = `http://127.0.0.1:${webServer.address().port}`;
  browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  const errors = [], writes = [];
  let failRoomList = false;
  // Every API call goes to the isolated test database, including real login.
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (failRoomList && request.method() === 'GET' && url.pathname === '/api/rooms') { failRoomList = false; return route.abort('failed'); }
    if (['PUT', 'DELETE'].includes(request.method()) && url.pathname.includes('/rooms/')) writes.push({ method: request.method(), body: request.postDataJSON() });
    const response = await fetch(apiBase + url.pathname + url.search, {
      method: request.method(), headers: { 'Content-Type': 'application/json', ...(request.headers().authorization ? { Authorization: request.headers().authorization } : {}) },
      ...(['GET', 'HEAD'].includes(request.method()) ? {} : { body: request.postData() }),
    });
    await route.fulfill({ status: response.status, body: await response.text(), headers: { ...cors, 'content-type': 'application/json' } });
  });
  page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(10000);
  const button = name => page.getByRole('button', { name, exact: true });
  async function visible(text) { await page.getByText(text, { exact: true }).filter({ visible: true }).waitFor(); checks++; }
  async function login(email) {
    await page.goto(base);
    await button('Nhân viên / Admin').click();
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await button('Đăng nhập').click();
    await button('Thu tiền & đối soát').waitFor();
  }
  async function openRooms() { await button('Quản lý phòng chiếu').click(); await visible('Thông tin phòng, sơ đồ ghế và tình trạng vận hành.'); }
  async function saveSeats() {
    await button('Xem lại thay đổi').click();
    await button('Xác nhận và lưu ghế').click();
    await visible('Đã lưu cấu hình ghế.');
  }
  async function noOverflow() {
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No page overflow');
  }
  async function inViewport(locator, description) {
    const box = await locator.boundingBox();
    check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= page.viewportSize().width && box.y + box.height <= page.viewportSize().height, description);
  }
  stage = 'login and create';
  await login(admin.email); await openRooms(); await visible('Other Room');
  stage = 'large seat map keeps editing controls visible';
  await button('Cấu hình ghế · Other Room').click();
  await page.getByRole('button', { name: /^Ghế D1,/ }).click();
  await visible('Chỉnh 1 ghế');
  await inViewport(button('VIP'), 'Type control visible immediately after selecting a seat in a large room');
  await inViewport(button('Hỏng'), 'Condition control visible immediately after selection');
  await inViewport(button('Xem lại thay đổi'), 'Review action stays in viewport');
  check((await page.getByTestId('room-seat-map').boundingBox()).height < 400, 'Large map has bounded height');
  await page.screenshot({ path: path.join(artifacts, 'large-room-editing.png') });
  await button('VIP').click();
  await page.getByRole('button', { name: /^Ghế D2,/ }).click(); await visible('Chỉnh 2 ghế');
  await inViewport(button('VIP'), 'Multiple seat selection keeps controls visible');
  await button('Thu gọn').click(); await button('Mở chỉnh ghế').click();
  await page.setViewportSize({ width: 375, height: 667 });
  await inViewport(button('VIP'), 'Controls remain reachable on a short phone');
  await inViewport(button('Xem lại thay đổi'), 'Review remains reachable on a short phone');
  await page.setViewportSize({ width: 812, height: 375 }); await inViewport(button('Xem lại thay đổi'), 'Review remains reachable in landscape');
  await page.setViewportSize({ width: 375, height: 812 });
  await button('← Danh sách phòng chiếu').click();
  stage = 'login and create';
  await button('Thêm phòng chiếu').click();
  check(await button('Bảo trì').count() === 0, 'New room excludes Maintenance');
  await page.getByRole('textbox', { name: 'Rạp', exact: true }).fill('Mobile Cinema');
  await page.getByRole('textbox', { name: 'Tên phòng', exact: true }).fill('Mobile Room');
  await page.getByLabel('Số hàng (1–26)', { exact: true }).fill('0');
  await button('Tạo phòng chiếu').click();
  await visible('Chọn 1–26 hàng, 1–40 ghế mỗi hàng và tối đa 1000 ghế.');
  check(await Room.countDocuments({ name: 'Mobile Room' }) === 0, 'Invalid layout is not submitted');
  await page.getByLabel('Số hàng (1–26)', { exact: true }).fill('2');
  await page.getByLabel('Ghế mỗi hàng (1–40)', { exact: true }).fill('3');
  await button('Tạo phòng chiếu').click(); await button('Cấu hình ghế').waitFor();
  let room = await Room.findOne({ name: 'Mobile Room' });
  check(room?.seats.length === 6 && room.status === 'Inactive', 'Created inactive room with six seats');
  await noOverflow(); await page.screenshot({ path: path.join(artifacts, 'room-editor.png') });

  stage = 'edit and stale version';
  await button('Bảo trì').click(); await button('Lưu thông tin phòng').click(); await visible('Đã cập nhật phòng chiếu.');
  check((await Room.findById(room._id)).status === 'Maintenance', 'Status persisted');
  await Room.updateOne({ _id: room._id }, { $inc: { __v: 1 } });
  await page.getByRole('textbox', { name: 'Tên phòng', exact: true }).fill('Unsaved Room');
  await button('Lưu thông tin phòng').click(); await visible('Phòng đã thay đổi hoặc thiếu phiên bản. Hãy tải lại phòng trước khi tiếp tục.');
  check((await Room.findById(room._id)).name === 'Mobile Room', 'Stale version rejected');
  check(await page.getByRole('textbox', { name: 'Tên phòng', exact: true }).inputValue() === 'Unsaved Room', 'Failed form retains draft');
  await button('Tải lại phòng').click(); await button('Xác nhận thực hiện').click();
  await page.getByRole('textbox', { name: 'Tên phòng', exact: true }).waitFor();
  await button('Cấu hình ghế').click();

  stage = 'seat edit, preview invalidation and save';
  const seat = number => page.getByRole('button', { name: new RegExp(`^Ghế ${number},`) });
  await seat('A1').click(); await button('VIP').click(); await button('Hỏng').click();
  await button('Xem lại thay đổi').click(); await button('Xác nhận và lưu ghế').waitFor();
  await button('Mở chỉnh ghế').click();
  await button('Bảo trì').click();
  check(await button('Xác nhận và lưu ghế').count() === 0, 'Changing draft invalidates review');
  await page.getByRole('textbox', { name: 'Mã ghế mới', exact: true }).fill('C1'); await button('Thêm ghế').click();
  await saveSeats();
  room = await Room.findById(room._id);
  check(room.seats.length === 7 && room.seatConfigs.get('A1').type === 'VIP' && room.seatConfigs.get('A1').status === 'Maintenance', 'Seat type, condition and addition persisted');
  check(writes.some(v => v.body.confirmed === true && Number.isInteger(v.body.version)), 'Seat save sends confirmed and version');
  await noOverflow(); await page.screenshot({ path: path.join(artifacts, 'seat-editor.png') });
  await page.setViewportSize({ width: 812, height: 375 }); await noOverflow();
  await page.setViewportSize({ width: 768, height: 1024 }); await noOverflow();
  await page.setViewportSize({ width: 375, height: 812 });
  await seat('C1').click(); await button('Xóa ghế đã chọn').click(); await button('Xác nhận thực hiện').click(); await saveSeats();
  check(!(await Room.findById(room._id)).seats.includes('C1'), 'Seat removal persisted');

  stage = 'bulk edits, rename and regenerate';
  await button('Chọn hàng B').click(); await button('VIP').click(); await button('Bỏ chọn').click();
  await seat('B3').click(); await page.getByRole('textbox', { name: 'Mã ghế mới', exact: true }).fill('B4'); await button('Đổi mã ghế đang chọn').click();
  await saveSeats();
  room = await Room.findById(room._id);
  check(room.seats.includes('B4') && !room.seats.includes('B3') && room.seatConfigs.get('B4').type === 'VIP', 'Rename retains metadata and row selection applies to all seats');
  check(room.seatConfigs.get('B1').type === 'VIP' && room.seatConfigs.get('B2').type === 'VIP', 'Bulk type saved');
  await page.getByRole('textbox', { name: 'Số hàng mới (1–26)', exact: true }).fill('2');
  await page.getByRole('textbox', { name: 'Ghế mỗi hàng mới (1–40)', exact: true }).fill('3');
  await button('Tạo lại sơ đồ ghế').click(); await button('Xác nhận thực hiện').click(); await saveSeats();
  room = await Room.findById(room._id);
  check(room.seats.includes('B3') && !room.seats.includes('B4') && room.seatConfigs.get('B1').type === 'VIP', 'Regenerate retains matching seat metadata');

  stage = 'protected seats and deletion';
  const movie = await Movie.create({ title: 'Mobile Room Test', duration: 90, classification: 'P' });
  const show = await Showtime.create({ cinema: room.cinema, room: room.name, roomId: room._id, movie: movie._id, startTime: new Date(Date.now() + 3600000), price: 80000, seats: room.seats.map(number => ({ number })) });
  await Booking.create({ user: member._id, showtime: show._id, seats: ['A2'], subtotal: 80000, total: 80000, status: 'paid', paymentStatus: 'paid' });
  await seat('A2').click(); await button('Hỏng').click(); await button('Xem lại thay đổi').click();
  await visible('Ghế A2 có giữ chỗ hoặc vé được bảo vệ trong suất chưa kết thúc.');
  check(await button('Xác nhận và lưu ghế').isDisabled(), 'Conflict prevents save');
  await button('← Danh sách phòng chiếu').click(); await button('Sửa / xóa · Mobile Room').click();
  await button('Xóa phòng').click(); await button('Xác nhận thực hiện').click();
  await visible('Phòng đã có suất chiếu hoặc lịch sử giao dịch. Không thể xóa; chỉ phòng chưa được tham chiếu mới được xóa.');

  stage = 'search, cinema and status filters';
  await button('← Danh sách phòng chiếu').click();
  await page.getByRole('textbox', { name: 'Tìm phòng', exact: true }).fill('Missing Room'); await button('Tìm kiếm').click(); await visible('Chưa có phòng phù hợp');
  await page.getByRole('textbox', { name: 'Tìm phòng', exact: true }).fill(''); await button('Tìm kiếm').click(); await visible('Mobile Room');
  await button('Lọc theo rạp').click(); await button('Other Cinema').click(); await visible('Other Room');
  check(await button('Sửa / xóa · Mobile Room').count() === 0, 'Cinema filter works');
  await button('Lọc theo rạp').click(); await button('Tất cả rạp').click(); await button('Hoạt động').click(); await visible('Chưa có phòng phù hợp');
  await button('Tất cả trạng thái').click(); await visible('Mobile Room');
  await page.getByRole('textbox', { name: 'Tìm rạp', exact: true }).waitFor({ state: 'hidden' });
  await button('Sửa / xóa · Mobile Room').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, 'room-list.png') });

  stage = 'safe delete and permissions';
  await button('Sửa / xóa · Other Room').click(); await button('Xóa phòng').click(); await button('Xác nhận thực hiện').click();
  await visible('Mobile Room'); check(await Room.countDocuments({ name: 'Other Room' }) === 0, 'Unreferenced room deleted');
  stage = 'pagination and network retry';
  await Room.insertMany(Array.from({ length: 11 }, (_, i) => ({ cinema: 'Z Cinema', name: `Z Room ${String(i).padStart(2, '0')}`, status: 'Inactive', seats: ['A1'] })));
  await button('Tải lại danh sách').click(); await visible('12 phòng chiếu · Trang 1/2');
  await button('Trang sau').click(); await visible('12 phòng chiếu · Trang 2/2'); await visible('Z Room 10');
  check(await button('Trang sau').isDisabled(), 'Final page disables next');
  await button('Trang trước').click(); await visible('12 phòng chiếu · Trang 1/2');
  failRoomList = true; await button('Tải lại danh sách').click();
  await visible('Không kết nối được máy chủ. Kiểm tra mạng và địa chỉ API.');
  await button('Tải lại danh sách').click(); await visible('Mobile Room');
  await login('employee@mobile-rooms.test');
  check(await button('Quản lý phòng chiếu').count() === 0, 'Employee has no room management task');
  check(errors.length === 0, `No browser errors: ${errors.join('; ')}`);
  console.log(`PASS mobile rooms: ${checks} checks using isolated database`);
} catch (error) {
  console.error('Failed stage:', stage);
  await mkdir(artifacts, { recursive: true });
  if (page) { console.error((await page.locator('body').innerText()).slice(-5000)); await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {}); }
  throw error;
} finally {
  await browser?.close();
  if (apiServer) await new Promise(resolve => apiServer.close(resolve));
  if (webServer) await new Promise(resolve => webServer.close(resolve));
  assert.equal(mongoose.connection.name, dbName);
  await mongoose.connection.dropDatabase(); await mongoose.disconnect();
}
