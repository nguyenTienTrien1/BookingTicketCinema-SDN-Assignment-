import * as service from '../services/showtimeService.js';

export async function list(req, res, next) {
  try {
    res.json(await service.listShowtimes(req.query));
  } catch (error) {
    next(error);
  }
}

