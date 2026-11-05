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

