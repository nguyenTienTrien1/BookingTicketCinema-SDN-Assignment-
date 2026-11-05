import * as service from '../services/foodSaleService.js';

export async function catalogue(req, res, next) {
  try { res.json(await service.counterCatalogue()); } catch (error) { next(error); }
}
export async function create(req, res, next) {
  try { res.status(201).json(await service.createFoodSale(req.body, req.user._id)); } catch (error) { next(error); }
}
export async function detail(req, res, next) {
  try { res.json(await service.getFoodSale(req.params.id, req.user._id)); } catch (error) { next(error); }
}
export async function cancel(req, res, next) {
  try { res.json(await service.cancelFoodSale(req.params.id, req.user._id)); } catch (error) { next(error); }
}
export async function pay(req, res, next) {
  try { res.json(await service.payFoodSale(req.params.id, req.body, req.user._id)); } catch (error) { next(error); }
}
