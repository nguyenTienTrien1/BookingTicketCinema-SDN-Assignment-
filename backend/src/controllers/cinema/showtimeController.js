import * as service from "../../services/cinema/showtimeService.js";

export async function suggest(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await service.suggestShowtimes(req.body, req.user._id));
  } catch (error) { next(error); }
}

export async function confirm(req, res, next) {
  try {
    const result = await service.confirmSuggestions(req.body, req.user._id);
    res.status(201).json({ message: `Đã thêm ${result.count} suất chiếu từ lịch đề xuất.`, ...result });
  } catch (error) { next(error); }
}

export function protectWrite(req, res, next) {
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  if (req.get('Sec-Fetch-Site') === 'cross-site' || (req.get('Origin') && req.get('Origin') !== allowedOrigin)) {
    return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
  }
  if (!req.is('application/json')) {
    return res.status(415).json({ message: 'Yêu cầu phải dùng application/json.' });
  }
  next();
}

export async function viewShowtimes(req, res, next) {
  try {
    res.json(await service.listShowtimes(req.query));
  } catch (error) {
    next(error);
  }
}

export async function addShowtime(req, res, next) {
  try {
    const showtime = await service.validateAndCreate(req.body, req.user._id);
    res.status(201).json({ message: 'Thêm suất chiếu thành công.', showtime });
  } catch (error) {
    next(error);
  }
}

export async function updateShowtime(req, res, next) {
  try {
    const showtime = await service.validateAndUpdate(req.params.id, req.body, req.user._id);
    res.json({ message: 'Cập nhật suất chiếu thành công.', showtime });
  } catch (error) {
    next(error);
  }
}

export async function deleteShowtime(req, res, next) {
  try {
    await service.validateAndRemove(req.params.id, req.body, req.user._id);
    res.json({ message: 'Xóa suất chiếu thành công.' });
  } catch (error) {
    next(error);
  }
}

export async function rooms(req, res, next) {
  try {
    const rooms = await service.listRooms();
    res.json(rooms);
  } catch (error) {
    next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const showtime = await service.getShowtime(req.params.id);
    res.json(showtime);
  } catch (error) {
    next(error);
  }
}
