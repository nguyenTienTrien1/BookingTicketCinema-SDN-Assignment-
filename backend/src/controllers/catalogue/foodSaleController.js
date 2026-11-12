import * as service from "../../services/catalogue/foodSaleService.js";
import { createFoodVnpay } from '../../services/catalogue/foodSaleVnpayService.js';
import { processSandboxReturn } from '../../services/payments/vnpayService.js';
import FoodSale from '../../models/catalogue/FoodSale.js';
import { validateMobileReturn } from '../../services/payments/mobileReturn.js';

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
  try { res.json(await createFoodVnpay(req.params.id, req.user._id, req.ip, req.body?.mobileReturnTo || null)); } catch (error) { next(error); }
}
export async function returnUrl(req, res, next) {
  try {
    await processSandboxReturn(req.query);
    if (typeof req.query.vnp_TxnRef === 'string') {
      const order = await FoodSale.findOne({ 'onlinePayment.ref': req.query.vnp_TxnRef }).select('onlinePayment.mobileReturnTo');
      if (order?.onlinePayment?.mobileReturnTo) {
        const target = new URL(validateMobileReturn(order.onlinePayment.mobileReturnTo));
        target.searchParams.set('foodSale', String(order._id));
        const href = target.toString().replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
        const script = JSON.stringify(target.toString()).replaceAll('<', '\\u003c');
        return res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).type('html').send(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CINEMA+</title><body style="background:#090b10;color:white;font:18px system-ui;padding:32px"><h1>CINEMA+</h1><p>Quay lại app để kiểm tra kết quả đơn F&amp;B.</p><a style="color:#ff7a96" href="${href}">Mở lại CINEMA+</a><script>location.href=${script}</script></body></html>`);
      }
    }
    const url = new URL('/employee/food-sales', process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173');
    // The page reloads its own persisted order; query-string success flags are never trusted.
    res.set('Cache-Control', 'no-store').redirect(url.toString());
  } catch (error) { next(error); }
}
