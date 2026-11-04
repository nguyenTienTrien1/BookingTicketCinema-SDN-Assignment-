import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import mongoose from 'mongoose';
// C-classified movies remain visible to Admin, but are not published for sale.
export const listMovies=()=>Movie.find({ classification: { $ne: 'C' }, deletedAt: null }).sort({featured:-1,createdAt:-1});
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
  const filter = { deletedAt: null };
  if (query.search && query.search.trim()) {
    filter.title = { $regex: escapeSearch(query.search.trim()), $options: 'i' };
  }
  const total = await Movie.countDocuments(filter);
  const movies = await Movie.find(filter).sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit).limit(limit);
  return { movies, total, page, totalPages: Math.ceil(total / limit) };
}

function validateMedia(value, required, name) {
  if (value === undefined || value === '') {
    if (required) throw movieError(`Vui lòng nhập ${name}.`);
    return '';
  }
  if (typeof value !== 'string' || value.length > 2048) {
    throw movieError(`${name} không hợp lệ.`);
  }
  const trimmed = value.trim();
  // Allow local asset paths and HTTP(S) links; reject executable/data URLs.
  if (/^\/(?!\/)[^\s\\]+$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') return trimmed;
  } catch {
    // Fall through to the validation error.
  }
  throw movieError(`${name} phải là đường dẫn /... hoặc URL http/https.`);
}

function validateMovie(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw movieError('Thông tin phim không hợp lệ.');
  }
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 200) {
    throw movieError('Tên phim bắt buộc và không được vượt quá 200 ký tự.');
  }
  if (typeof input.description !== 'string' || !input.description.trim() || input.description.length > 5000) {
    throw movieError('Mô tả bắt buộc và không được vượt quá 5000 ký tự.');
  }
  if (!Array.isArray(input.genre) || input.genre.length < 1 || input.genre.length > 10) {
    throw movieError('Vui lòng nhập từ 1 đến 10 thể loại.');
  }
  const genre = [];
  for (const item of input.genre) {
    if (typeof item !== 'string' || !item.trim() || item.trim().length > 50) {
      throw movieError('Mỗi thể loại phải có từ 1 đến 50 ký tự.');
    }
    if (!genre.includes(item.trim())) genre.push(item.trim());
  }
  if (typeof input.duration !== 'number' || !Number.isInteger(input.duration) || input.duration < 1 || input.duration > 1440) {
    throw movieError('Thời lượng phải là số nguyên từ 1 đến 1440 phút.');
  }
  const ageLimits = { P: 0, K: 0, T13: 13, T16: 16, T18: 18, C: 0 };
  if (typeof input.classification !== 'string' || !Object.hasOwn(ageLimits, input.classification)) {
    throw movieError('Vui lòng chọn phân loại P, K, T13, T16, T18 hoặc C.');
  }
  if (typeof input.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.releaseDate)) {
    throw movieError('Ngày khởi chiếu phải có định dạng YYYY-MM-DD.');
  }
  const releaseDate = new Date(input.releaseDate);
  if (Number.isNaN(releaseDate.getTime()) || releaseDate.toISOString().slice(0, 10) !== input.releaseDate) {
    throw movieError('Ngày khởi chiếu không hợp lệ.');
  }
  const rating = input.rating === undefined ? 0 : input.rating;
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0 || rating > 10) {
    throw movieError('Điểm đánh giá phải nằm trong khoảng 0 đến 10.');
  }
  if (input.featured !== undefined && typeof input.featured !== 'boolean') {
    throw movieError('Trạng thái nổi bật phải là true hoặc false.');
  }
  const poster = validateMedia(input.poster, true, 'Poster');
  const banner = validateMedia(input.banner, false, 'Banner');
  const title = input.title.trim();
  return {
    title, description: input.description.trim(), genre, duration: input.duration,
    classification: input.classification, ageLimit: ageLimits[input.classification],
    releaseDate, poster, banner, rating, featured: input.featured === true
  };
}

async function checkDuplicate(data, excludeId) {
  const filter = { title: { $regex: `^${escapeSearch(data.title)}$`, $options: 'i' }, releaseDate: data.releaseDate, deletedAt: null };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Movie.exists(filter)) throw movieError('Phim có cùng tên và ngày khởi chiếu đã tồn tại.', 409);
}

export async function createMovie(input, adminId) {
  const data = validateMovie(input);
  await checkDuplicate(data);
  return Movie.create({ ...data, createdBy: adminId });
}

export async function getAdminMovie(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw movieError('Mã phim không hợp lệ.');
  const movie = await Movie.findOne({ _id: id, deletedAt: null });
  if (!movie) throw movieError('Không tìm thấy phim.', 404);
  return { movie, hasShowtimes: Boolean(await Showtime.exists({ movie: id })) };
}

function checkVersion(input) {
  if (!input || !Number.isInteger(input.version) || input.version < 0) {
    throw movieError('Thiếu phiên bản phim hợp lệ. Vui lòng tải lại thông tin phim.');
  }
}

export async function updateMovie(id, input, adminId) {
  checkVersion(input);
  const { movie, hasShowtimes } = await getAdminMovie(id);
  const data = validateMovie(input);
  const classification = movie.classification || (movie.ageLimit > 0 ? `T${movie.ageLimit}` : 'P');
  if (hasShowtimes && (data.title !== movie.title || data.duration !== movie.duration ||
      data.classification !== classification || data.releaseDate.getTime() !== movie.releaseDate?.getTime())) {
    throw movieError('Phim đã có suất chiếu. Không thể đổi tên, thời lượng, phân loại hoặc ngày khởi chiếu.', 409);
  }
  await checkDuplicate(data, id);
  const updated = await Movie.findOneAndUpdate(
    { _id: id, deletedAt: null, __v: input.version },
    { $set: { ...data, updatedBy: adminId }, $inc: { __v: 1 } },
    { new: true, runValidators: true }
  );
  if (!updated) throw movieError('Phim đã được thay đổi. Vui lòng tải lại trước khi lưu.', 409);
  return updated;
}

export async function deleteMovie(id, input, adminId) {
  checkVersion(input);
  const { hasShowtimes } = await getAdminMovie(id);
  if (hasShowtimes) throw movieError('Không thể xóa phim đã có suất chiếu. Lịch chiếu và lịch sử giao dịch được giữ nguyên.', 409);
  // Soft deletion keeps audit data and protects references created concurrently.
  const removed = await Movie.findOneAndUpdate(
    { _id: id, deletedAt: null, __v: input.version },
    { $set: { deletedAt: new Date(), deletedBy: adminId }, $inc: { __v: 1 } }, { new: true }
  );
  if (!removed) throw movieError('Phim đã được thay đổi. Vui lòng tải lại trước khi xóa.', 409);
  return removed;
}
