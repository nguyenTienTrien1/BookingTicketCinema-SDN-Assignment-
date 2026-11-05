import mongoose from 'mongoose';

import Food from '../models/Food.js';

import Promotion from '../models/Promotion.js';

import FoodSale from '../models/FoodSale.js';

import Booking from '../models/Booking.js';

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

export async function createFood(body, adminId) {
  const data = foodData(body);
  await Food.init();
  await checkFoodName(data);
  return Food.create({ ...data, createdBy: adminId });
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

export async function availablePromotions(query) {
  if (query.scope !== undefined && !['food', 'ticket', 'all'].includes(query.scope)) throw invalid('Phạm vi không hợp lệ.');
  const now = new Date();
  const filter = { deletedAt: null, active: true, startsAt: { $lte: now }, endsAt: { $gt: now },
    $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] };
  if (query.scope && query.scope !== 'all') filter.scope = { $in: [query.scope, 'all'] };
  return Promotion.find(filter).select('-createdBy -updatedBy -deletedBy -deletedAt').sort({ code: 1 }).limit(100);
}
