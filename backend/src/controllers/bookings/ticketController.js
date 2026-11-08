import * as service from "../../services/bookings/ticketService.js";

export function protectWrite(req, res, next) {
  const origin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  if (req.get('Sec-Fetch-Site') === 'cross-site' || (req.get('Origin') && req.get('Origin') !== origin)) return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
  if (!req.is('application/json')) return res.status(415).json({ message: 'Yêu cầu phải dùng application/json.' });
  next();
}
export async function owned(req, res, next) {
  try { res.set('Cache-Control', 'no-store').json(await service.ownedTickets(req.params.id, req.user._id)); } catch (error) { next(error); }
}
export async function showtimes(req, res, next) {
  try { res.set('Cache-Control', 'no-store').json(await service.checkInShowtimes()); } catch (error) { next(error); }
}
export async function lookup(req, res, next) {
  try { res.set('Cache-Control', 'no-store').json(await service.lookupTicket(req.query.reference, req.query.showtimeId)); } catch (error) { next(error); }
}
export async function checkIn(req, res, next) {
  try { res.set('Cache-Control', 'no-store').json(await service.checkInTicket(req.params.reference, req.body, req.user._id)); } catch (error) { next(error); }
}
