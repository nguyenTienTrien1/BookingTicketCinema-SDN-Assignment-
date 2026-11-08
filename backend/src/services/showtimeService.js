import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { transaction } from './transaction.js';
import Showtime from '../models/Showtime.js';
import Movie from '../models/Movie.js';
import Booking from '../models/Booking.js';
import CinemaRoom, { seatConfiguration } from '../models/CinemaRoom.js';

const MINUTE = 60000;
const DAY = 24 * 60 * MINUTE;
const CLEANING = 15 * MINUTE;
const MAX_SLOTS = 200;
// Short-lived previews are signed by this server, not trusted from client input.
const previewSecret = randomBytes(32);

// The current app runs one Node process. Reject simultaneous schedule writes
// so two Admin requests cannot both pass the same room-conflict check.
let scheduleBusy = false;

// Share the existing single-process guard with room writes and seat claims.
export async function withScheduleWrite(work) {
  if (scheduleBusy) throw showtimeError('Phòng hoặc lịch chiếu đang được cập nhật. Vui lòng thử lại.', 409);
  scheduleBusy = true;
  try { return await work(); }
  finally { scheduleBusy = false; }
}

function showtimeError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkId(id) {
  if (typeof id !== 'string' || !mongoose.isObjectIdOrHexString(id)) {
    throw showtimeError('Mã phim hoặc suất chiếu không hợp lệ.');
  }
}

async function showtimePage(filter, direction, skip, limit) {
  return Showtime.find(filter)
    .select('-seats.bookingId -seats.holdUntil')
    .populate('movie', 'title duration classification ageLimit')
    .sort({ startTime: direction, _id: direction }).skip(skip).limit(limit);
}

export async function listShowtimes(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw showtimeError('Phân trang không hợp lệ.');
  }
  const filter = {};
  if (query.movie) {
    checkId(query.movie);
    filter.movie = query.movie;
  }
  const now = new Date();
  const upcomingFilter = { ...filter, startTime: { $gte: now } };
  const pastFilter = { ...filter, startTime: { $lt: now } };
  const total = await Showtime.countDocuments(filter);
  const upcomingTotal = await Showtime.countDocuments(upcomingFilter);
  const offset = (page - 1) * limit;
  const showtimes = [];
  // Paginate one combined order: upcoming (soonest first), then past (latest first).
  if (offset < upcomingTotal) {
    showtimes.push(...await showtimePage(upcomingFilter, 1, offset, limit));
  }
  if (showtimes.length < limit && offset < total) {
    const pastOffset = Math.max(0, offset - upcomingTotal);
    showtimes.push(...await showtimePage(pastFilter, -1, pastOffset, limit - showtimes.length));
  }
  return { showtimes, total, page, totalPages: Math.ceil(total / limit) };
}

async function validateShowtime(body, excludedId, session = null) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw showtimeError('Thông tin suất chiếu không hợp lệ.');
  }
  checkId(body.movie);
  if (typeof body.cinema !== 'string' || !body.cinema.trim() || body.cinema.length > 100 ||
      typeof body.room !== 'string' || !body.room.trim() || body.room.length > 100) {
    throw showtimeError('Tên rạp và phòng chiếu phải có từ 1 đến 100 ký tự.');
  }
  // Require an explicit timezone so the server never guesses the cinema's local time.
  if (typeof body.startTime !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/.test(body.startTime)) {
    throw showtimeError('Thời gian bắt đầu phải là ngày giờ có múi giờ hợp lệ.');
  }
  const startTime = new Date(body.startTime);
  const calendarDate = body.startTime.slice(0, 10);
  const parsedDate = new Date(`${calendarDate}T00:00:00Z`);
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== calendarDate ||
      Number(body.startTime.slice(11, 13)) > 23 || Number(body.startTime.slice(14, 16)) > 59 ||
      Number(body.startTime.slice(17, 19)) > 59 || startTime <= new Date()) {
    throw showtimeError('Thời gian bắt đầu phải hợp lệ và nằm trong tương lai.');
  }
  if (typeof body.price !== 'number' || !Number.isSafeInteger(body.price) || body.price <= 0) {
    throw showtimeError('Giá vé phải là số nguyên dương (VND).');
  }
  const movieQuery = Movie.findById(body.movie);
  if (session) movieQuery.session(session);
  const movie = await movieQuery;
  if (!movie || movie.deletedAt) throw showtimeError('Không tìm thấy phim.', 404);
  if (movie.classification === 'C') throw showtimeError('Không thể tạo suất chiếu cho phim phân loại C.');
  if (!Number.isFinite(movie.duration) || movie.duration <= 0) {
    throw showtimeError('Phim chưa có thời lượng hợp lệ.');
  }
  const cinemaDate = new Date(startTime.getTime() + 7 * 60 * 60000).toISOString().slice(0, 10);
  if (movie.releaseDate && cinemaDate < movie.releaseDate.toISOString().slice(0, 10)) {
    throw showtimeError('Suất chiếu không được trước ngày khởi chiếu của phim.');
  }
  const cinema = body.cinema.trim();
  const room = body.room.trim();
  const roomQuery = CinemaRoom.findOne({ cinema, name: room })
    .collation({ locale: 'en', strength: 2 });
  if (session) roomQuery.session(session);
  const configuredRoom = await roomQuery;
  if (!configuredRoom) throw showtimeError('Phòng chiếu chưa được cấu hình.', 400);
  if (configuredRoom.status !== 'Active') throw showtimeError('Phòng chiếu không hoạt động.', 409);
  const layout = configuredRoom.seats;
  if (configuredRoom.validateSync()) {
    throw showtimeError('Sơ đồ ghế của phòng không hợp lệ.', 409);
  }
  const endTime = new Date(startTime.getTime() + (movie.duration + 15) * 60000);
  const filter = { cinema, room, startTime: { $lt: endTime }, cancelledAt: null };
  if (excludedId) filter._id = { $ne: excludedId };
  // Compare both ends: an earlier movie can still be playing when this one starts.
  const neighbourQuery = Showtime.find(filter).collation({ locale: 'en', strength: 2 })
    .populate('movie', 'duration');
  if (session) neighbourQuery.session(session);
  const neighbours = await neighbourQuery;
  for (const neighbour of neighbours) {
    if (!neighbour.movie || !Number.isFinite(neighbour.movie.duration)) {
      throw showtimeError('Không thể kiểm tra lịch do suất cùng phòng thiếu thông tin phim.', 409);
    }
    const neighbourEnd = neighbour.startTime.getTime() + (neighbour.movie.duration + 15) * 60000;
    if (neighbourEnd > startTime.getTime()) {
      throw showtimeError('Phòng đã có suất chiếu trùng lịch, gồm 15 phút dọn phòng.', 409);
    }
  }
  const seats = [];
  for (const number of layout) {
    const config = seatConfiguration(configuredRoom, number);
    seats.push({ number, status: 'available', type: config.type, condition: config.status });
  }
  return { movie: movie._id, cinema: configuredRoom.cinema, room: configuredRoom.name,
    roomId: configuredRoom._id, startTime, price: body.price,
    seats };

}

export async function validateAndCreate(body, adminId) {
  return withScheduleWrite(async function () {
    const data = await validateShowtime(body);
    const showtime = await Showtime.create(data);
    console.info('[SHOWTIME AUDIT]', JSON.stringify({ action: 'create', adminId, showtimeId: showtime._id }));
    return showtime;
  });
}

async function editableShowtime(id, body) {
  checkId(id);
  const showtime = await Showtime.findById(id);
  if (!showtime) throw showtimeError('Không tìm thấy suất chiếu.', 404);
  if (showtime.cancelledAt) throw showtimeError('Suất đã hủy được giữ lại để đối chiếu giao dịch; không sửa hoặc xóa.', 409);
  if (!body || typeof body.updatedAt !== 'string' || !showtime.updatedAt ||
      body.updatedAt !== showtime.updatedAt.toISOString()) {
    throw showtimeError('Suất chiếu đã thay đổi. Vui lòng tải lại danh sách trước khi tiếp tục.', 409);
  }
  if (showtime.startTime <= new Date()) {
    throw showtimeError('Không thể sửa hoặc xóa suất chiếu đã bắt đầu.', 409);
  }
  // Keep all booking references, including cancelled bookings, for transaction history.
  if (await Booking.exists({ showtime: id })) {
    throw showtimeError('Suất chiếu đã có đặt vé. Không thể sửa/xóa trực tiếp; cần quy trình hủy và hoàn tiền.', 409);
  }
  for (const seat of showtime.seats) {
    if (seat.status !== 'available' || seat.bookingId) {
      throw showtimeError('Suất chiếu có ghế đang giữ hoặc đã bán. Không thể sửa/xóa trực tiếp.', 409);
    }
  }
  return showtime;
}

function unbookedFilter(showtime) {
  // Check again in the write itself in case a booking claims seats after our read.
  return {
    _id: showtime._id, updatedAt: showtime.updatedAt,
    seats: { $not: { $elemMatch: { $or: [
      { status: { $ne: 'available' } }, { bookingId: { $ne: null } }
    ] } } }
  };
}

export async function validateAndUpdate(id, body, adminId) {
  return withScheduleWrite(async function () {
    const current = await editableShowtime(id, body);
    const data = await validateShowtime(body, id);
    // Preserve seat identifiers when the configured layout is unchanged.
    if (current.seats.length === data.seats.length &&
        current.seats.every((seat, index) => seat.number === data.seats[index].number)) {
      if (current.cinema === data.cinema && current.room === data.room) data.seats = current.seats;
      else {
        // Keep stable identifiers while taking the destination room's metadata.
        for (let index = 0; index < data.seats.length; index++) data.seats[index]._id = current.seats[index]._id;
      }
    }
    const showtime = await Showtime.findOneAndUpdate(unbookedFilter(current), { $set: data },
      { new: true, runValidators: true });
    if (!showtime) throw showtimeError('Suất chiếu vừa thay đổi hoặc có ghế được giữ. Vui lòng tải lại.', 409);
    console.info('[SHOWTIME AUDIT]', JSON.stringify({ action: 'update', adminId, showtimeId: id }));
    return showtime;
  });
}

export async function validateAndRemove(id, body, adminId) {
  return withScheduleWrite(async function () {
    const current = await editableShowtime(id, body);
    const showtime = await Showtime.findOneAndDelete(unbookedFilter(current));
    if (!showtime) throw showtimeError('Suất chiếu vừa thay đổi hoặc có ghế được giữ. Vui lòng tải lại.', 409);
    console.info('[SHOWTIME AUDIT]', JSON.stringify({ action: 'delete', adminId, showtimeId: id }));
  });
}

export async function listRooms() {
  return CinemaRoom.find({ status: 'Active' }).select('cinema name seats updatedAt').sort({ cinema: 1, name: 1 });
}

export async function getShowtime(id) {
  checkId(id);
  const showtime = await Showtime.findById(id).select('-seats.bookingId -seats.holdUntil')
    .populate('movie', 'title duration classification ageLimit');
  if (!showtime) throw showtimeError('Không tìm thấy suất chiếu.', 404);
  return showtime;
}

// Automatic suggestions use the same validation and write guard as manual schedules.
function localDate(value) {
  return new Date(new Date(value).getTime() + 7 * 60 * MINUTE).toISOString().slice(0, 10);
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw showtimeError('Ngày phải theo định dạng YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw showtimeError('Ngày không tồn tại.');
  return new Date(`${value}T00:00:00+07:00`);
}

function validateInput(body, now) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw showtimeError('Thông tin đề xuất không hợp lệ.');
  for (const field of Object.keys(body)) {
    if (!['movie', 'cinema', 'startDate', 'endDate', 'openingTime', 'closingTime', 'price'].includes(field)) {
      throw showtimeError('Chỉ chọn phim, rạp, khoảng ngày, giờ hoạt động và giá vé; phòng sẽ được tự chọn.');
    }
  }
  if (typeof body.movie !== 'string' || !mongoose.isObjectIdOrHexString(body.movie)) throw showtimeError('Mã phim không hợp lệ.');
  if (typeof body.cinema !== 'string' || !body.cinema.trim() || body.cinema.length > 100) throw showtimeError('Vui lòng chọn rạp hợp lệ.');
  const start = parseDate(body.startDate);
  const end = parseDate(body.endDate);
  if (body.startDate < localDate(now) || end < start || end - start >= 31 * DAY) {
    throw showtimeError('Chọn từ hôm nay trở đi, ngày kết thúc không trước ngày bắt đầu và tối đa 31 ngày.');
  }
  for (const time of [body.openingTime, body.closingTime]) {
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw showtimeError('Giờ hoạt động phải theo định dạng HH:mm.');
  }
  if (body.openingTime >= body.closingTime) throw showtimeError('Giờ đóng cửa phải sau giờ mở cửa trong cùng ngày.');
  if (!Number.isSafeInteger(body.price) || body.price <= 0) throw showtimeError('Giá vé phải là số nguyên dương (VND).');
  return { movie: body.movie, cinema: body.cinema.trim(), startDate: body.startDate,
    endDate: body.endDate, openingTime: body.openingTime, closingTime: body.closingTime, price: body.price };
}

// Find the first gap that fits the movie AND its cleanup before the next show.
function firstGap(intervals, cursor, duration) {
  let start = cursor;
  for (const busy of intervals) {
    if (busy.end <= start) continue;
    if (start + duration + CLEANING <= busy.start) break;
    start = busy.end;
  }
  return start;
}

export async function suggestShowtimes(body, adminId) {
  const now = new Date();
  const input = validateInput(body, now);
  const movie = await Movie.findById(input.movie);
  if (!movie || movie.deletedAt) throw showtimeError('Không tìm thấy phim.', 404);
  if (movie.classification === 'C') throw showtimeError('Không thể đề xuất suất chiếu cho phim phân loại C.');
  if (!Number.isFinite(movie.duration) || movie.duration <= 0) throw showtimeError('Phim chưa có thời lượng hợp lệ.');
  if (movie.releaseDate && input.startDate < movie.releaseDate.toISOString().slice(0, 10)) {
    throw showtimeError('Khoảng đề xuất không được trước ngày khởi chiếu của phim.');
  }
  const configuredRooms = await CinemaRoom.find({ cinema: input.cinema, status: 'Active' })
    .collation({ locale: 'en', strength: 2 }).sort({ name: 1, _id: 1 });
  const rooms = [];
  for (const room of configuredRooms) {
    // Auto-selection only considers valid rooms with at least one usable seat.
    if (!room.validateSync() && room.seats.some(number => seatConfiguration(room, number).status === 'Active')) rooms.push(room);
  }
  if (rooms.length === 0) throw showtimeError('Rạp chưa có phòng đang hoạt động với sơ đồ ghế sử dụng được.', 409);
  const windowEnd = new Date(`${input.endDate}T${input.closingTime}:00+07:00`);
  const shows = await Showtime.find({
    cancelledAt: null,
    // Include neighbours just after closing: a final film's cleanup must not
    // collide with them, even if that neighbour was added outside these hours.
    cinema: input.cinema, startTime: { $lt: new Date(windowEnd.getTime() + CLEANING) },
    $or: [{ roomId: { $in: rooms.map(room => room._id) } },
      { roomId: null, room: { $in: rooms.map(room => room.name) } }]
  }).collation({ locale: 'en', strength: 2 }).select('roomId room startTime movie').populate('movie', 'duration');
  const timelines = new Map();
  for (const room of rooms) timelines.set(String(room._id), []);
  for (const show of shows) {
    const room = rooms.find(item => show.roomId ? String(item._id) === String(show.roomId) : item.name.toLowerCase() === show.room.toLowerCase());
    if (!room) continue;
    if (!show.movie || !Number.isFinite(show.movie.duration) || show.movie.duration <= 0) {
      throw showtimeError('Chưa thể kiểm tra lịch vì suất cùng rạp thiếu thời lượng phim. Vui lòng kiểm tra dữ liệu lịch chiếu.', 409);
    }
    timelines.get(String(room._id)).push({ start: show.startTime.getTime(), end: show.startTime.getTime() + show.movie.duration * MINUTE + CLEANING });
  }
  for (const timeline of timelines.values()) timeline.sort((a, b) => a.start - b.start);
  const days = [];
  const slots = [];
  const duration = movie.duration * MINUTE;
  for (let day = parseDate(input.startDate); day <= parseDate(input.endDate); day = new Date(day.getTime() + DAY)) {
    const date = localDate(day);
    const close = new Date(`${date}T${input.closingTime}:00+07:00`).getTime();
    let cursor = Math.max(new Date(`${date}T${input.openingTime}:00+07:00`).getTime(), Math.ceil((now.getTime() + 1) / MINUTE) * MINUTE);
    const daySlots = [];
    const assigned = new Map();
    for (const room of rooms) assigned.set(String(room._id), 0);
    while (cursor + duration <= close) {
      let best = null;
      for (const room of rooms) {
        const key = String(room._id);
        const start = firstGap(timelines.get(key), cursor, duration);
        if (start + duration > close) continue;
        if (!best || start < best.start || (start === best.start && assigned.get(key) < assigned.get(String(best.room._id)))) {
          best = { room, start };
        }
      }
      if (!best) break;
      const roomId = String(best.room._id);
      const slot = { movie: String(movie._id), cinema: best.room.cinema, room: best.room.name, roomId,
        startTime: new Date(best.start).toISOString(), endTime: new Date(best.start + duration).toISOString(), price: input.price };
      slots.push(slot);
      daySlots.push(slot);
      if (slots.length > MAX_SLOTS) throw showtimeError('Lịch đề xuất vượt 200 suất. Vui lòng thu hẹp khoảng ngày hoặc giờ hoạt động.');
      timelines.get(roomId).push({ start: best.start, end: best.start + duration + CLEANING });
      timelines.get(roomId).sort((a, b) => a.start - b.start);
      assigned.set(roomId, assigned.get(roomId) + 1);
      // One chronological series for this movie, rather than flooding every room
      // with simultaneous screenings. Prefer less-used rooms for equal gaps.
      cursor = best.start + duration + CLEANING;
    }
    days.push({ date, slots: daySlots });
  }
  const roomVersions = [];
  for (const room of rooms) {
    if (slots.some(slot => slot.roomId === String(room._id))) {
      roomVersions.push({ id: String(room._id), updatedAt: room.updatedAt.toISOString() });
    }
  }
  const token = slots.length === 0 ? null : jwt.sign({ adminId: String(adminId),
    input, slots, movieVersion: movie.updatedAt.toISOString(), roomVersions }, previewSecret, { expiresIn: '15m', algorithm: 'HS256' });
  return { input, movie: { _id: movie._id, title: movie.title, duration: movie.duration },
    timezone: 'Asia/Ho_Chi_Minh', cleaningMinutes: 15, days, total: slots.length, token,
    generatedAt: now.toISOString(), expiresAt: token ? new Date(jwt.decode(token).exp * 1000).toISOString() : null };
}

export async function confirmSuggestions(body, adminId) {
  if (!body || typeof body.token !== 'string' || body.token.length > 90000 || Object.keys(body).some(key => key !== 'token')) {
    throw showtimeError('Vui lòng tạo và kiểm tra lịch đề xuất trước khi lưu.');
  }
  let preview;
  try { preview = jwt.verify(body.token, previewSecret, { algorithms: ['HS256'] }); }
  catch (error) {
    if (error.name === 'TokenExpiredError') throw showtimeError('Đề xuất đã hết hạn sau 15 phút. Vui lòng tạo lại.', 410);
    throw showtimeError('Đề xuất không còn hợp lệ. Vui lòng tạo lại.');
  }
  if (preview.adminId !== String(adminId)) throw showtimeError('Bạn không có quyền lưu đề xuất này.', 403);
  return withScheduleWrite(async function () {
    return transaction(async function (session) {
      const movie = await Movie.findById(preview.input.movie).session(session);
      if (!movie || movie.deletedAt || movie.updatedAt.toISOString() !== preview.movieVersion) {
        throw showtimeError('Phim đã thay đổi. Vui lòng tạo lại lịch đề xuất.', 409);
      }
      for (const version of preview.roomVersions) {
        const room = await CinemaRoom.findById(version.id).session(session);
        if (!room || room.updatedAt.toISOString() !== version.updatedAt) throw showtimeError('Phòng đã thay đổi. Vui lòng tạo lại lịch đề xuất.', 409);
      }
      const documents = [];
      for (const slot of preview.slots) {
        // Reuse manual validation: current movie, room, release date, seats,
        // price, future time and overlaps are all rechecked inside the write.
        documents.push(await validateShowtime(slot, undefined, session));
      }
      // One transaction saves every reviewed slot or none, even on a DB failure.
      const created = await Showtime.insertMany(documents, { session, ordered: true });
      console.info('[SHOWTIME AUDIT]', JSON.stringify({ action: 'create-suggestions', adminId, count: created.length }));
      return { count: created.length, showtimeIds: created.map(show => show._id) };
    });
  });
}
