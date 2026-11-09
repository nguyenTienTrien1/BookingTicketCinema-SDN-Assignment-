import { trustedClientRequest } from '../../config/clientOrigins.js';
import * as service from "../../services/catalogue/catalogueService.js";

export function protectWrite(req, res, next) {
  if (!trustedClientRequest(req)) {
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
export async function updateFood(req, res, next) {
  try { res.json(await service.updateFood(req.params.id, req.body, req.user._id)); } catch (error) { handleError(error, next, 'food'); }
}
export async function deleteFood(req, res, next) {
  try { await service.deleteFood(req.params.id, req.body, req.user._id); res.json({ message: 'Đã xóa sản phẩm khỏi danh mục.' }); }
  catch (error) { handleError(error, next, 'food'); }
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
export async function updatePromotion(req, res, next) {
  try { res.json(await service.updatePromotion(req.params.id, req.body, req.user._id)); } catch (error) { handleError(error, next, 'promotion'); }
}
export async function deletePromotion(req, res, next) {
  try { await service.deletePromotion(req.params.id, req.body, req.user._id); res.json({ message: 'Đã xóa khuyến mãi khỏi danh mục.' }); }
  catch (error) { handleError(error, next, 'promotion'); }
}
export async function availablePromotions(req, res, next) {
  try { res.json(await service.availablePromotions(req.query)); } catch (error) { next(error); }
}
