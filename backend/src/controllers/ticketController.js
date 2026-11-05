import * as service from '../services/ticketService.js';

export async function owned(req, res, next) {
  try { res.set('Cache-Control', 'no-store').json(await service.ownedTickets(req.params.id, req.user._id)); } catch (error) { next(error); }
}
