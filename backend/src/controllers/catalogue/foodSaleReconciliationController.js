import * as service from '../../services/catalogue/foodSaleReconciliationService.js';
export async function lookup(req, res, next) {
  try { res.set('Cache-Control', 'no-store').json(await service.lookupStaffOrder(req.params.id, req.user._id)); } catch (error) { next(error); }
}
export async function list(req, res, next) {
  try { res.set('Cache-Control', 'no-store').json(await service.listFoodSaleReconciliation(req.user._id)); } catch (error) { next(error); }
}
export async function resolve(req, res, next) {
  try { res.json(await service.reconcileFoodSale(req.params.id, req.body, req.user._id)); } catch (error) { next(error); }
}
