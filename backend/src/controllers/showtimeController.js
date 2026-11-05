import * as service from '../services/showtimeService.js';

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

export async function list(req, res, next) {
  try {
    res.json(await service.listShowtimes(req.query));
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const showtime = await service.createShowtime(req.body, req.user._id);
    res.status(201).json({ message: 'Thêm suất chiếu thành công.', showtime });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const showtime = await service.updateShowtime(req.params.id, req.body, req.user._id);
    res.json({ message: 'Cập nhật suất chiếu thành công.', showtime });
  } catch (error) {
    next(error);
  }
}

