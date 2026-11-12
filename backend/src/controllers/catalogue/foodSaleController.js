import * as service from "../../services/catalogue/foodSaleService.js";
import { createFoodVnpay } from '../../services/catalogue/foodSaleVnpayService.js';
import { processSandboxReturn } from '../../services/payments/vnpayService.js';

export async function catalogue(req, res, next) {
  try { res.json(await service.counterCatalogue()); } catch (error) { next(error); }
}
export async function create(req, res, next) {
  try { res.status(201).json(await service.createFoodSale(req.body, req.user._id)); } catch (error) { next(error); }
}
export async function detail(req, res, next) {
  try { res.set('Cache-Control', 'no-store').json(await service.getFoodSale(req.params.id, req.user._id)); } catch (error) { next(error); }
}
export async function cancel(req, res, next) {
  try { res.json(await service.cancelFoodSale(req.params.id, req.user._id)); } catch (error) { next(error); }
}
export async function pay(req, res, next) {
  try { res.json(await service.payFoodSale(req.params.id, req.body, req.user._id)); } catch (error) { next(error); }
}
export async function promotion(req, res, next) {
  try { res.json(await service.applyFoodPromotion(req.params.id, req.body, req.user._id)); } catch (error) { next(error); }
}
export async function vnpay(req, res, next) {
  try { res.json(await createFoodVnpay(req.params.id, req.user._id, req.ip)); } catch (error) { next(error); }
}
export async function returnUrl(req, res, next) {
  try {
    await processSandboxReturn(req.query);
    const url = new URL('/employee/food-sales', process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173');
    // The page reloads its own persisted order; query-string success flags are never trusted.
    res.set('Cache-Control', 'no-store').redirect(url.toString());
  } catch (error) { next(error); }
}
