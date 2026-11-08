import mongoose from 'mongoose';
import Food from "../../models/catalogue/Food.js";
import Promotion from "../../models/catalogue/Promotion.js";
import FoodSale from "../../models/catalogue/FoodSale.js";
import Booking from "../../models/bookings/Booking.js";

function invalid(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Thông tin không hợp lệ.');
}

function text(value, name, max, required = true) {
  if (!required && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    throw invalid(`${name} ${required ? 'bắt buộc và ' : ''}không được vượt quá ${max} ký tự.`);
  }
  return value.trim();
}

function integer(value, name, min = 0, max = 1000000000) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw invalid(`${name} phải là số nguyên từ ${min} đến ${max}.`);
  return value;
}

function flag(value, name) {
  if (typeof value !== 'boolean') throw invalid(`Vui lòng chọn ${name}.`);
  return value;
}

function media(value) {
  const image = text(value, 'Đường dẫn ảnh', 2048, false);
  if (!image || /^\/(?!\/)[^\s\\]+$/.test(image)) return image;
  try {
    const url = new URL(image);
    if (url.protocol === 'http:' || url.protocol === 'https:') return image;
  } catch { /* Use the same validation error for malformed links. */ }
  throw invalid('Ảnh phải là URL http/https hoặc đường dẫn /... trên website.');
}

function escaped(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function version(body) {
  checkBody(body);
  integer(body.version, 'Phiên bản', 0, Number.MAX_SAFE_INTEGER);
}

async function findRecord(Model, id) {
  if (typeof id !== 'string' || !mongoose.isObjectIdOrHexString(id)) throw invalid('Mã bản ghi không hợp lệ.');
  const record = await Model.findOne({ _id: id, deletedAt: null });
  if (!record) throw invalid('Không tìm thấy bản ghi.', 404);
  return record;
}

async function list(Model, query, fields) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  integer(page, 'Trang', 1, 1000000);
  integer(limit, 'Số bản ghi mỗi trang', 1, 50);
  const filter = { deletedAt: null };
  if (Model === Food) {
    if (query.availability !== undefined && !['available', 'paused'].includes(query.availability)) throw invalid('Trạng thái bán không hợp lệ.');
    if (query.stockState !== undefined && !['in-stock', 'low', 'out-of-stock'].includes(query.stockState)) throw invalid('Bộ lọc tồn kho không hợp lệ.');
    if (query.availability) filter.available = query.availability === 'available';
    if (query.stockState === 'in-stock') filter.stock = { $gt: 0 };
    if (query.stockState === 'low') filter.stock = { $gt: 0, $lte: 5 };
    if (query.stockState === 'out-of-stock') filter.$expr = { $lte: [{ $ifNull: ['$stock', 0] }, 0] };
  } else {
    if (query.scope !== undefined && !['food', 'ticket', 'all'].includes(query.scope)) throw invalid('Phạm vi áp dụng không hợp lệ.');
    if (query.status !== undefined && !['current', 'future', 'expired', 'exhausted', 'paused'].includes(query.status)) throw invalid('Trạng thái khuyến mãi không hợp lệ.');
    if (query.scope) filter.scope = query.scope;
    if (query.status) {
      const now = new Date(); filter.active = query.status !== 'paused';
      if (query.status === 'future') filter.startsAt = { $gt: now };
      if (query.status === 'expired') filter.endsAt = { $lte: now };
      if (['current', 'exhausted'].includes(query.status)) {
        filter.startsAt = { $lte: now }; filter.endsAt = { $gt: now };
        if (query.status === 'current') filter.$and = [{ $or: [{ usageLimit: null }, { $expr: { $lt: [{ $ifNull: ['$usedCount', 0] }, '$usageLimit'] } }] }];
        else { filter.usageLimit = { $ne: null }; filter.$expr = { $gte: [{ $ifNull: ['$usedCount', 0] }, '$usageLimit'] }; }
      }
    }
  }
  if (query.search !== undefined) {
    const search = text(query.search, 'Từ khóa', 100, false);
    if (search) filter.$or = fields.map((field) => ({ [field]: { $regex: escaped(search), $options: 'i' } }));
  }
  const total = await Model.countDocuments(filter);
  const items = await Model.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
  return { items, total, page, totalPages: Math.ceil(total / limit) };
}

export const listFoods = (query) => list(Food, query, ['name']);
export const listPromotions = (query) => list(Promotion, query, ['name', 'code']);
export const getFood = (id) => findRecord(Food, id);
export const getPromotion = (id) => findRecord(Promotion, id);

function foodData(body) {
  checkBody(body);
  const name = text(body.name, 'Tên sản phẩm', 100);
  return {
    name, nameKey: name.toLowerCase(), description: text(body.description, 'Mô tả', 2000, false),
    image: media(body.image), price: integer(body.price, 'Giá bán'),
    stock: integer(body.stock, 'Tồn kho'), available: flag(body.available, 'trạng thái bán')
  };
}

async function checkFoodName(data, excludeId) {
  const filter = { name: { $regex: `^${escaped(data.name)}$`, $options: 'i' }, deletedAt: null };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Food.exists(filter)) throw invalid('Tên sản phẩm đã tồn tại.', 409);
}

async function openFoodOrder(id) {
  if (await FoodSale.exists({ 'items.food': id, status: { $in: ['pending', 'payment_received', 'reconciliation'] } })) return true;
  return Boolean(await Booking.exists({ 'foodItems.food': id, status: 'pending', $or: [
    { expiresAt: { $gt: new Date() } }, { expiresAt: null }
  ] }));
}

export async function createFood(body, adminId) {
  const data = foodData(body);
  await Food.init();
  await checkFoodName(data);
  return Food.create({ ...data, createdBy: adminId });
}

export async function updateFood(id, body, adminId) {
  version(body);
  const current = await getFood(id);
  const data = foodData(body);
  if ((data.price !== current.price || data.available !== current.available || data.stock < current.stock) && await openFoodOrder(id)) {
    throw invalid('Sản phẩm có đơn đang xử lý. Không thể đổi giá, trạng thái bán hoặc giảm tồn kho.', 409);
  }
  await checkFoodName(data, id);
  const stockFilter = current.stock === 0 ? { $or: [{ stock: 0 }, { stock: { $exists: false } }] } : { stock: current.stock };
  const record = await Food.findOneAndUpdate({ _id: id, deletedAt: null, __v: body.version, ...stockFilter },
    { $set: { ...data, updatedBy: adminId }, $inc: { __v: 1 } }, { new: true, runValidators: true });
  if (!record) throw invalid('Thông tin hoặc tồn kho đã thay đổi. Vui lòng tải lại trước khi lưu.', 409);
  return record;
}

export async function deleteFood(id, body, adminId) {
  version(body);
  await getFood(id);
  if (await openFoodOrder(id)) throw invalid('Không thể xóa sản phẩm có đơn hàng đang xử lý hoặc chờ đối soát.', 409);
  const record = await Food.findOneAndUpdate({ _id: id, deletedAt: null, __v: body.version },
    { $set: { deletedAt: new Date(), deletedBy: adminId, available: false }, $inc: { __v: 1 } }, { new: true });
  if (!record) throw invalid('Bản ghi đã thay đổi. Vui lòng tải lại trước khi xóa.', 409);
}

function date(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw invalid(`${name} phải có ngày giờ và múi giờ hợp lệ.`);
  }
  const parsed = new Date(value);
  const calendar = new Date(value.slice(0, 10));
  if (!Number.isFinite(parsed.getTime()) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10) ||
      Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) {
    throw invalid(`${name} không hợp lệ.`);
  }
  return parsed;
}

function promotionData(body) {
  checkBody(body);
  const code = text(body.code, 'Mã khuyến mãi', 40).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) throw invalid('Mã gồm 3–40 chữ cái, chữ số, dấu gạch ngang hoặc gạch dưới.');
  if (!['percentage', 'fixed'].includes(body.discountType)) throw invalid('Vui lòng chọn giảm phần trăm hoặc số tiền cố định.');
  if (!['food', 'ticket', 'all'].includes(body.scope)) throw invalid('Vui lòng chọn phạm vi áp dụng.');
  const startsAt = date(body.startsAt, 'Thời gian bắt đầu');
  const endsAt = date(body.endsAt, 'Thời gian kết thúc');
  if (startsAt >= endsAt) throw invalid('Thời gian kết thúc phải sau thời gian bắt đầu.');
  const value = integer(body.value, 'Mức giảm', 1, body.discountType === 'percentage' ? 100 : 1000000000);
  const maxDiscount = body.maxDiscount == null ? null : integer(body.maxDiscount, 'Giảm tối đa', 1);
  if (body.discountType === 'fixed' && maxDiscount !== null) throw invalid('Giảm tối đa chỉ dùng cho khuyến mãi phần trăm.');
  return {
    code, name: text(body.name, 'Tên khuyến mãi', 120), description: text(body.description, 'Mô tả', 2000, false),
    discountType: body.discountType, value, minOrder: integer(body.minOrder, 'Giá trị đơn tối thiểu'), maxDiscount,
    scope: body.scope, stackable: flag(body.stackable, 'chính sách cộng dồn'), startsAt, endsAt,
    usageLimit: body.usageLimit == null ? null : integer(body.usageLimit, 'Giới hạn sử dụng', 1), active: flag(body.active, 'trạng thái khuyến mãi')
  };
}

export async function createPromotion(body, adminId) {
  const data = promotionData(body);
  await Promotion.init();
  return Promotion.create({ ...data, createdBy: adminId });
}

export async function updatePromotion(id, body, adminId) {
  version(body);
  const current = await getPromotion(id);
  const data = promotionData(body);
  if (data.usageLimit !== null && data.usageLimit < current.usedCount) throw invalid('Giới hạn sử dụng không được nhỏ hơn số lượt đã dùng.');
  if (current.usedCount > 0 && (data.code !== current.code || data.discountType !== current.discountType ||
      data.value !== current.value || data.scope !== current.scope)) {
    throw invalid('Khuyến mãi đã được dùng: không thể đổi mã, loại giảm, mức giảm hoặc phạm vi.', 409);
  }
  const record = await Promotion.findOneAndUpdate({ _id: id, deletedAt: null, __v: body.version, usedCount: current.usedCount },
    { $set: { ...data, updatedBy: adminId }, $inc: { __v: 1 } }, { new: true, runValidators: true });
  if (!record) throw invalid('Khuyến mãi hoặc số lượt sử dụng đã thay đổi. Vui lòng tải lại.', 409);
  return record;
}

export async function deletePromotion(id, body, adminId) {
  version(body);
  await getPromotion(id);
  const record = await Promotion.findOneAndUpdate({ _id: id, deletedAt: null, __v: body.version },
    { $set: { deletedAt: new Date(), deletedBy: adminId, active: false }, $inc: { __v: 1 } }, { new: true });
  if (!record) throw invalid('Khuyến mãi đã thay đổi. Vui lòng tải lại trước khi xóa.', 409);
}

export async function availablePromotions(query) {
  if (query.scope !== undefined && !['food', 'ticket', 'all'].includes(query.scope)) throw invalid('Phạm vi không hợp lệ.');
  const now = new Date();
  const filter = { deletedAt: null, active: true, startsAt: { $lte: now }, endsAt: { $gt: now },
    $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] };
  if (query.scope && query.scope !== 'all') filter.scope = { $in: [query.scope, 'all'] };
  return Promotion.find(filter).select('-createdBy -updatedBy -deletedBy -deletedAt').sort({ code: 1 }).limit(100);
}
