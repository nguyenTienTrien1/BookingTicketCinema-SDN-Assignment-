import * as service from '../services/catalogueService.js';

export function protectWrite(req, res, next) {
  const origin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  if (req.get('Sec-Fetch-Site') === 'cross-site' || (req.get('Origin') && req.get('Origin') !== origin)) {
    return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
  }
  if (!req.is('application/json')) return res.status(415).json({ message: 'Yêu cầu phải dùng application/json.' });
  next();
}

function handleError(error, next, resource) {
  if (error.code === 11000) {
    const conflict = new Error(resource === 'food' ? 'Tên sản phẩm đã tồn tại.' : 'Mã khuyến mãi đã tồn tại, kể cả mã đã lưu trữ.');
    conflict.status = 409;
    return next(conflict);
  }
  next(error);
}

export async function foods(req, res, next) {
  try { res.json(await service.listFoods(req.query)); } catch (error) { handleError(error, next, 'food'); }
}

export async function food(req, res, next) {
  try { res.json(await service.getFood(req.params.id)); } catch (error) { handleError(error, next, 'food'); }
}

export async function createFood(req, res, next) {
  try { res.status(201).json(await service.createFood(req.body, req.user._id)); } catch (error) { handleError(error, next, 'food'); }
}

export async function promotions(req, res, next) {
  try { res.json(await service.listPromotions(req.query)); } catch (error) { handleError(error, next, 'promotion'); }
}

export async function promotion(req, res, next) {
  try { res.json(await service.getPromotion(req.params.id)); } catch (error) { handleError(error, next, 'promotion'); }
}

export async function createPromotion(req, res, next) {
  try { res.status(201).json(await service.createPromotion(req.body, req.user._id)); } catch (error) { handleError(error, next, 'promotion'); }
}

export async function availablePromotions(req, res, next) {
  try { res.json(await service.availablePromotions(req.query)); } catch (error) { next(error); }
}
