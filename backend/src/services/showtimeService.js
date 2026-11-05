import mongoose from 'mongoose';
import Showtime from '../models/Showtime.js';
import Movie from '../models/Movie.js';
import Booking from '../models/Booking.js';

// The current app runs one Node process. Reject simultaneous schedule writes
// so two Admin requests cannot both pass the same room-conflict check.
let scheduleBusy = false;

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
  const total = await Showtime.countDocuments(filter);
  const showtimes = await Showtime.find(filter)
    .select('-seats.bookingId -seats.holdUntil')
    .populate('movie', 'title duration classification ageLimit')
    .sort({ startTime: 1, _id: 1 }).skip((page - 1) * limit).limit(limit);
  return { showtimes, total, page, totalPages: Math.ceil(total / limit) };
}

async function validateShowtime(body, excludedId) {
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
  const movie = await Movie.findById(body.movie);
  if (!movie) throw showtimeError('Không tìm thấy phim.', 404);
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
  const endTime = new Date(startTime.getTime() + (movie.duration + 15) * 60000);
  const filter = { cinema, room, startTime: { $lt: endTime } };
  if (excludedId) filter._id = { $ne: excludedId };
  // Compare both ends: an earlier movie can still be playing when this one starts.
  const neighbours = await Showtime.find(filter).collation({ locale: 'en', strength: 2 })
    .populate('movie', 'duration');
  for (const neighbour of neighbours) {
    if (!neighbour.movie || !Number.isFinite(neighbour.movie.duration)) {
      throw showtimeError('Không thể kiểm tra lịch do suất cùng phòng thiếu thông tin phim.', 409);
    }
    const neighbourEnd = neighbour.startTime.getTime() + (neighbour.movie.duration + 15) * 60000;
    if (neighbourEnd > startTime.getTime()) {
      throw showtimeError('Phòng đã có suất chiếu trùng lịch, gồm 15 phút dọn phòng.', 409);
    }
  }
  return { movie: movie._id, cinema, room, startTime, price: body.price };
}

export async function createShowtime(body, adminId) {
  if (scheduleBusy) throw showtimeError('Lịch chiếu đang được cập nhật. Vui lòng thử lại.', 409);
  scheduleBusy = true;
  try {
    const data = await validateShowtime(body);
    // Match the existing seed layout: A1–E8. Clients cannot supply seat states.
    data.seats = [];
    for (let row = 0; row < 5; row++) {
      for (let number = 1; number <= 8; number++) {
        data.seats.push({ number: String.fromCharCode(65 + row) + number, status: 'available' });
      }
    }
    const showtime = await Showtime.create(data);
    console.info('[SHOWTIME AUDIT]', JSON.stringify({ action: 'create', adminId, showtimeId: showtime._id }));
    return showtime;
  } finally {
    scheduleBusy = false;
  }
}

async function editableShowtime(id, body) {
  checkId(id);
  const showtime = await Showtime.findById(id);
  if (!showtime) throw showtimeError('Không tìm thấy suất chiếu.', 404);
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

export async function updateShowtime(id, body, adminId) {
  if (scheduleBusy) throw showtimeError('Lịch chiếu đang được cập nhật. Vui lòng thử lại.', 409);
  scheduleBusy = true;
  try {
    const current = await editableShowtime(id, body);
    const data = await validateShowtime(body, id);
    const showtime = await Showtime.findOneAndUpdate(unbookedFilter(current), { $set: data },
      { new: true, runValidators: true });
    if (!showtime) throw showtimeError('Suất chiếu vừa thay đổi hoặc có ghế được giữ. Vui lòng tải lại.', 409);
    console.info('[SHOWTIME AUDIT]', JSON.stringify({ action: 'update', adminId, showtimeId: id }));
    return showtime;
  } finally {
    scheduleBusy = false;
  }
}

