import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
export const listMovies=()=>Movie.find().sort({featured:-1,createdAt:-1});
export const listShowtimes=(movieId)=>Showtime.find(movieId?{movie:movieId}:{}).populate('movie').sort({startTime:1});
export const getMovie=id=>Movie.findById(id);

function movieError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function escapeSearch(value) {
  // Treat search text as a literal title, never as a user-supplied regex.
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listAdminMovies(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw movieError('Phân trang không hợp lệ. Mỗi trang có từ 1 đến 50 phim.');
  }
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 200)) {
    throw movieError('Từ khóa tìm kiếm không hợp lệ.');
  }
  const filter = {};
  if (query.search && query.search.trim()) {
    filter.title = { $regex: escapeSearch(query.search.trim()), $options: 'i' };
  }
  const total = await Movie.countDocuments(filter);
  const movies = await Movie.find(filter).sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit).limit(limit);
  return { movies, total, page, totalPages: Math.ceil(total / limit) };
}
