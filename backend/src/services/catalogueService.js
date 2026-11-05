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

export async function availablePromotions(query) {
  if (query.scope !== undefined && !['food', 'ticket', 'all'].includes(query.scope)) throw invalid('Phạm vi không hợp lệ.');
  const now = new Date();
  const filter = { deletedAt: null, active: true, startsAt: { $lte: now }, endsAt: { $gt: now },
    $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] };
  if (query.scope && query.scope !== 'all') filter.scope = { $in: [query.scope, 'all'] };
  return Promotion.find(filter).select('-createdBy -updatedBy -deletedBy -deletedAt').sort({ code: 1 }).limit(100);
}
