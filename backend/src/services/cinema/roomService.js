import mongoose from 'mongoose';
import CinemaRoom, { seatConfiguration } from "../../models/cinema/CinemaRoom.js";
import Showtime from "../../models/cinema/Showtime.js";
import Booking from "../../models/bookings/Booking.js";
import { withScheduleWrite } from './showtimeService.js';

const statuses = ['Active', 'Inactive', 'Maintenance'];
const conditions = ['Active', 'Broken', 'Maintenance', 'Disabled'];
export const ROOM_LAYOUT_POLICY = 'Cấu hình ghế áp dụng cho suất chiếu được tạo sau khi lưu. Suất chiếu đã có giữ nguyên sơ đồ và giá vé.';

function fail(message, status = 400) { return Object.assign(new Error(message), { status }); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function checkId(id) {
  if (typeof id !== 'string' || !mongoose.isObjectIdOrHexString(id)) throw fail('Mã phòng không hợp lệ.');
}
export function roomData(room) {
  const seatConfigs = {};
  for (const number of room.seats) seatConfigs[number] = seatConfiguration(room, number);
  return { _id: room._id, cinema: room.cinema, name: room.name, status: room.status,
    seats: room.seats, seatConfigs, capacity: room.seats.length, version: room.__v || 0,
    updatedAt: room.updatedAt, layoutPolicy: ROOM_LAYOUT_POLICY };
}
async function findRoom(id) {
  checkId(id);
  const room = await CinemaRoom.findById(id);
  if (!room) throw fail('Không tìm thấy phòng chiếu.', 404);
  return room;
}
function checkVersion(room, body) {
  if (!object(body) || !Number.isSafeInteger(body.version) || body.version !== (room.__v || 0)) {
    throw fail('Phòng đã thay đổi hoặc thiếu phiên bản. Hãy tải lại phòng trước khi tiếp tục.', 409);
  }
}
function versionFilter(room) { return { _id: room._id, __v: { $in: [room.__v || 0, null] } }; }

async function validateRoom(data) {
  if (!object(data) || typeof data.cinema !== 'string' || !data.cinema.trim() || data.cinema.trim().length > 100 ||
      typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 100 ||
      (data.status !== undefined && !statuses.includes(data.status))) throw fail('Tên rạp, tên phòng hoặc trạng thái không hợp lệ.');
  if (!Array.isArray(data.seats) || data.seats.length === 0 || data.seats.length > 1000) throw fail('Sơ đồ phải có từ 1 đến 1000 ghế.');
  const seen = new Set();
  for (const seat of data.seats) {
    if (typeof seat !== 'string' || seat.length > 32 || !/^[A-Z]+[1-9][0-9]*$/.test(seat) || seen.has(seat)) throw fail('Mã ghế phải duy nhất, dạng A1, B2 hoặc AA12.');
    seen.add(seat);
  }
  if (data.seatConfigs !== undefined && !object(data.seatConfigs)) throw fail('Thuộc tính ghế không hợp lệ.');
  const seatConfigs = data.seatConfigs || {};
  for (const key of Object.keys(seatConfigs)) {
    const config = seatConfigs[key];
    if (!seen.has(key) || !object(config) || !['Standard', 'VIP'].includes(config.type) || !conditions.includes(config.status) ||
        Object.keys(config).some(field => !['type', 'status'].includes(field))) throw fail('Loại/tình trạng ghế không hợp lệ hoặc ghế không tồn tại.');
  }
  const candidate = new CinemaRoom({ cinema: data.cinema.trim(), name: data.name.trim(), status: data.status || 'Inactive', seats: data.seats, seatConfigs });
  await candidate.validate();
  return roomData(candidate);
}

export async function listRooms(query) {
  const page = Number(query.page || 1), limit = Number(query.limit || 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw fail('Phân trang không hợp lệ.');
  const filter = {};
  for (const field of ['search', 'cinema', 'status']) if (query[field] !== undefined && (typeof query[field] !== 'string' || query[field].length > 200)) throw fail('Bộ lọc không hợp lệ.');
  if (query.search) filter.name = { $regex: query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (query.cinema) filter.cinema = query.cinema.trim();
  if (query.status) {
    if (!statuses.includes(query.status)) throw fail('Trạng thái phòng không hợp lệ.');
    filter.status = query.status;
  }
  const total = await CinemaRoom.countDocuments(filter).collation({ locale: 'en', strength: 2 });
  const rows = await CinemaRoom.find(filter).collation({ locale: 'en', strength: 2 }).sort({ cinema: 1, name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit);
  return { rooms: rows.map(roomData), total, page, totalPages: Math.ceil(total / limit), cinemas: await CinemaRoom.distinct('cinema') };
}
export async function getRoom(id) { return roomData(await findRoom(id)); }

function references(room) {
  return { $or: [{ roomId: room._id }, { roomId: null, cinema: room.cinema, room: room.name }] };
}
async function roomReferences(room) {
  return Showtime.find(references(room)).collation({ locale: 'en', strength: 2 }).populate('movie', 'duration').select('cinema room roomId movie startTime seats');
}
function scheduled(showtime, now) {
  if (showtime.startTime >= now) return true;
  // Missing movie duration is ambiguous, so fail closed rather than guessing.
  if (!showtime.movie || !Number.isFinite(showtime.movie.duration)) return true;
  return showtime.startTime.getTime() + (showtime.movie.duration + 15) * 60000 > now.getTime();
}
function changes(before, after) {
  const result = { before: before.seats.length, after: after.seats.length, added: [], removed: [], types: [], conditions: [] };
  for (const number of before.seats) {
    if (!after.seats.includes(number)) result.removed.push(number);
    else {
      const old = seatConfiguration(before, number), next = after.seatConfigs[number];
      if (old.type !== next.type) result.types.push({ seat: number, before: old.type, after: next.type });
      if (old.status !== next.status) result.conditions.push({ seat: number, before: old.status, after: next.status });
    }
  }
  for (const number of after.seats) if (!before.seats.includes(number)) result.added.push(number);
  return result;
}
async function review(room, candidate) {
  const diff = changes(room, candidate);
  const affected = new Set(diff.removed);
  for (const change of [...diff.types, ...diff.conditions]) affected.add(change.seat);
  const now = new Date();
  const shows = await roomReferences(room);
  const upcoming = shows.filter(show => scheduled(show, now));
  const protectedSeats = new Set();
  for (const show of upcoming) {
    for (const seat of show.seats) {
      if (seat.status === 'booked' || (seat.status === 'held' && (!seat.holdUntil || seat.holdUntil > now))) protectedSeats.add(seat.number);
    }
  }
  if (upcoming.length) {
    const bookings = await Booking.find({ showtime: { $in: upcoming.map(show => show._id) }, $or: [
      { status: 'paid' }, { paymentStatus: 'paid' },
      { status: 'pending', expiresAt: { $gt: now } }, { status: 'pending', expiresAt: null }
    ] }).select('seats');
    for (const booking of bookings) for (const number of booking.seats) protectedSeats.add(number);
  }
  const conflicts = [];
  for (const number of affected) if (protectedSeats.has(number)) conflicts.push(`Ghế ${number} có giữ chỗ hoặc vé được bảo vệ trong suất chưa kết thúc.`);
  return { ...diff, conflicts, canSave: conflicts.length === 0, scheduledShowtimes: upcoming.length,
    referencedShowtimes: shows.length, layoutPolicy: ROOM_LAYOUT_POLICY };
}
function audit(action, roomId, adminId) { console.info('[ROOM AUDIT]', JSON.stringify({ action, roomId, adminId })); }
function duplicate(error) {
  if (error.code === 11000) throw fail('Tên phòng đã tồn tại trong rạp này.', 409);
  throw error;
}
export async function createRoom(body, adminId) {
  return withScheduleWrite(async function () {
    const candidate = await validateRoom(body);
    if (!['Active', 'Inactive'].includes(candidate.status)) throw fail('Phòng mới chỉ được chọn Hoạt động hoặc Chưa hoạt động.');
    try {
      const room = await CinemaRoom.create({ cinema: candidate.cinema, name: candidate.name, status: candidate.status,
        seats: candidate.seats, seatConfigs: candidate.seatConfigs, lastModifiedBy: adminId });
      audit('create', room._id, adminId);
      return roomData(room);
    } catch (error) { duplicate(error); }
  });
}
export async function updateRoom(id, body, adminId) {
  return withScheduleWrite(async function () {
    const room = await findRoom(id);
    checkVersion(room, body);
    if (!statuses.includes(body.status)) throw fail('Trạng thái phòng không hợp lệ.');
    const candidate = await validateRoom({ cinema: body.cinema, name: body.name, status: body.status, seats: room.seats, seatConfigs: roomData(room).seatConfigs });
    const shows = await roomReferences(room);
    if ((candidate.cinema !== room.cinema || candidate.name !== room.name) && shows.length) throw fail('Không đổi tên/rạp của phòng đã có suất chiếu. Lịch sử cần giữ đúng tham chiếu.', 409);
    if (candidate.status !== 'Active' && room.status !== candidate.status && shows.some(show => scheduled(show, new Date()))) throw fail('Phòng còn suất chưa kết thúc. Không thể ngừng hoạt động hoặc bảo trì trực tiếp.', 409);
    try {
      const saved = await CinemaRoom.findOneAndUpdate(versionFilter(room), { $set: { cinema: candidate.cinema, name: candidate.name,
        status: candidate.status, lastModifiedBy: adminId }, $inc: { __v: 1 } }, { new: true });
      if (!saved) throw fail('Phòng vừa thay đổi. Vui lòng tải lại.', 409);
      audit('update', id, adminId);
      return roomData(saved);
    } catch (error) { duplicate(error); }
  });
}
export async function previewSeats(id, body) {
  const room = await findRoom(id);
  checkVersion(room, body);
  const candidate = await validateRoom({ cinema: room.cinema, name: room.name, status: room.status, seats: body.seats, seatConfigs: body.seatConfigs });
  return { review: await review(room, candidate), version: room.__v || 0 };
}
export async function updateSeats(id, body, adminId) {
  return withScheduleWrite(async function () {
    const room = await findRoom(id);
    checkVersion(room, body);
    if (body.confirmed !== true) throw fail('Cần xem lại và xác nhận cấu hình ghế trước khi lưu.');
    const candidate = await validateRoom({ cinema: room.cinema, name: room.name, status: room.status, seats: body.seats, seatConfigs: body.seatConfigs });
    const checked = await review(room, candidate); // Never trust a prior preview.
    if (!checked.canSave) throw fail(checked.conflicts.join(' '), 409);
    const saved = await CinemaRoom.findOneAndUpdate(versionFilter(room), { $set: { seats: candidate.seats,
      seatConfigs: candidate.seatConfigs, lastModifiedBy: adminId }, $inc: { __v: 1 } }, { new: true });
    if (!saved) throw fail('Phòng vừa thay đổi. Vui lòng tải lại.', 409);
    audit('configure-seats', id, adminId);
    return roomData(saved);
  });
}
export async function removeRoom(id, body, adminId) {
  return withScheduleWrite(async function () {
    const room = await findRoom(id);
    checkVersion(room, body);
    if (await Showtime.exists(references(room)).collation({ locale: 'en', strength: 2 })) throw fail('Phòng đã có suất chiếu hoặc lịch sử giao dịch. Không thể xóa; chỉ phòng chưa được tham chiếu mới được xóa.', 409);
    if (!await CinemaRoom.findOneAndDelete(versionFilter(room))) throw fail('Phòng vừa thay đổi. Vui lòng tải lại.', 409);
    audit('delete', id, adminId);
  });
}
