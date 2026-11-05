import mongoose from 'mongoose';
import RevenueEntry from '../models/RevenueEntry.js';
import RevenueReport from '../models/RevenueReport.js';
import FoodSale from '../models/FoodSale.js';

const DAY = 24 * 60 * 60 * 1000;
export const REPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const BASIS = 'VND thu thực tế theo ngày xác nhận; hoàn tiền theo ngày hoàn tất. Tiền thu = giá gốc - giảm giá + phí - điểm quy đổi; thu ròng = tiền thu - hoàn tiền. Không tính đơn demo, chờ xử lý hoặc chưa có chứng từ xác minh.';
const SOURCE_NOTE = 'Vé và bắp nước đi kèm chỉ được tính khi có chứng từ quyết toán đã xác minh. Thanh toán vé demo hiện tại chưa có chứng từ này nên chưa được tính. Bắp nước tại quầy được tính từ hóa đơn đã hoàn tất và có xác nhận thu tiền; không cộng lại bắp nước đi kèm vé.';

function reportError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseDay(value) {
  if (typeof value !== 'string' || !/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(value)) {
    throw reportError('Ngày phải theo định dạng YYYY-MM-DD, trong giai đoạn 2000–2099.');
  }
  const utc = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== value) {
    throw reportError('Ngày báo cáo không tồn tại.');
  }
  return new Date(value + 'T00:00:00.000+07:00');
}

export function validateFilters(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw reportError('Bộ lọc không hợp lệ.');
  for (const key of Object.keys(input)) {
    if (!['from', 'to', 'source', 'method', 'groupBy'].includes(key)) throw reportError('Bộ lọc không được hỗ trợ.');
  }
  const start = parseDay(input.from);
  const end = parseDay(input.to);
  if (end < start || (end - start) / DAY >= 366) throw reportError('Chọn khoảng báo cáo hợp lệ, tối đa 366 ngày.');
  const source = input.source === undefined ? 'all' : input.source;
  const method = input.method === undefined ? 'all' : input.method;
  const groupBy = input.groupBy === undefined ? 'day' : input.groupBy;
  if (!['all', 'tickets', 'food'].includes(source) ||
      !['all', 'cash', 'vnpay', 'momo', 'credit-card', 'points'].includes(method) ||
      !['day', 'month'].includes(groupBy)) throw reportError('Nguồn, phương thức hoặc cách nhóm không hợp lệ.');
  return { from: input.from, to: input.to, source, method, groupBy };
}

function metrics() {
  return { gross: 0, discounts: 0, fees: 0, points: 0, payments: 0, refunds: 0, net: 0, paymentCount: 0, refundCount: 0 };
}

function validMoney(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function checkPayment(entry) {
  for (const key of ['gross', 'discounts', 'fees', 'points', 'amount']) {
    if (!validMoney(entry[key])) throw reportError('Chứng từ có số tiền không hợp lệ; chưa thể tính báo cáo đầy đủ.', 409);
  }
  if (entry.discounts > entry.gross || entry.gross - entry.discounts + entry.fees - entry.points !== entry.amount) {
    throw reportError('Chứng từ không khớp cơ cấu tiền; cần đối soát trước khi báo cáo.', 409);
  }
}

function addMetrics(target, entry) {
  if (entry.kind === 'refund') {
    target.refunds += entry.amount;
    target.refundCount += 1;
  } else {
    target.gross += entry.gross;
    target.discounts += entry.discounts;
    target.fees += entry.fees;
    target.points += entry.points;
    target.payments += entry.amount;
    target.paymentCount += 1;
  }
  target.net = target.payments - target.refunds;
  for (const key of Object.keys(metrics())) {
    if (!Number.isSafeInteger(target[key])) throw reportError('Tổng tiền vượt giới hạn tính toán an toàn.', 409);
  }
}

function bucket(date, groupBy) {
  const day = new Date(new Date(date).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return groupBy === 'month' ? day.slice(0, 7) : day;
}

export async function createReport(input, adminId) {
  const filters = validateFilters(input);
  const dataTimestamp = new Date();
  const start = parseDay(filters.from);
  const end = new Date(parseDay(filters.to).getTime() + DAY);
  const totals = metrics();
  const sources = { tickets: metrics(), food: metrics() };
  const buckets = new Map();
  for (let day = start; day < end; day = new Date(day.getTime() + DAY)) {
    const key = bucket(day, filters.groupBy);
    if (!buckets.has(key)) buckets.set(key, { period: key, ...metrics() });
  }
  function include(entry, source) {
    addMetrics(totals, entry);
    addMetrics(sources[source], entry);
    addMetrics(buckets.get(bucket(entry.confirmedAt, filters.groupBy)), entry);
  }
  // Both confirmedAt and createdAt are bounded: later-arriving backdated entries
  // belong to a refresh, never to this captured result.
  if (filters.source !== 'food') {
    const query = { confirmedAt: { $gte: start, $lt: end, $lte: dataTimestamp }, createdAt: { $lte: dataTimestamp } };
    if (filters.method !== 'all') query.method = filters.method;
    for await (const entry of RevenueEntry.find(query).lean().cursor()) {
      if (entry.currency !== 'VND' || !entry.reference ||
          !['payment', 'refund'].includes(entry.kind) || !validMoney(entry.amount) ||
          !['cash', 'vnpay', 'momo', 'credit-card', 'points'].includes(entry.method)) {
        throw reportError('Chứng từ quyết toán không hợp lệ; cần đối soát trước khi báo cáo.', 409);
      }
      let expectedEvidence = 'provider-confirmation';
      if (entry.method === 'cash') expectedEvidence = 'employee-receipt';
      if (entry.method === 'points') expectedEvidence = 'points-ledger';
      if (entry.evidence !== expectedEvidence || (entry.method === 'points' && entry.amount !== 0)) {
        throw reportError('Chứng từ chưa đáp ứng điều kiện xác minh.', 409);
      }
      if (entry.kind === 'payment') checkPayment(entry);
      else {
        if (!entry.originalReference) throw reportError('Chứng từ hoàn tiền thiếu tham chiếu thanh toán gốc.', 409);
        const original = await RevenueEntry.findOne({
          reference: entry.originalReference, booking: entry.booking, kind: 'payment',
          createdAt: { $lte: dataTimestamp }, confirmedAt: { $lte: entry.confirmedAt }
        }).lean();
        if (!original || original.currency !== entry.currency || original.method !== entry.method || original.amount !== entry.amount) {
          throw reportError('Hoàn tiền phải khớp toàn bộ khoản thanh toán gốc.', 409);
        }
        checkPayment(original);
        if (original.evidence !== expectedEvidence) throw reportError('Khoản thanh toán gốc chưa được xác minh.', 409);
      }
      include(entry, 'tickets');
    }
  }
  let excludedFoodSales = 0;
  if (filters.source !== 'tickets' && ['all', 'cash'].includes(filters.method)) {
    const query = { status: 'paid', paidAt: { $gte: start, $lt: end, $lte: dataTimestamp }, createdAt: { $lte: dataTimestamp } };
    for await (const sale of FoodSale.find(query).lean().cursor()) {
      if (sale.currency !== 'VND' || sale.paymentMethod !== 'cash' || !sale.paymentConfirmedAt || sale.paymentConfirmedAt > sale.paidAt) {
        excludedFoodSales += 1;
        continue;
      }
      let gross = 0;
      for (const item of sale.items) {
        if (!validMoney(item.unitPrice) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
          throw reportError('Hóa đơn bắp nước có chi tiết không hợp lệ.', 409);
        }
        gross += item.unitPrice * item.quantity;
      }
      const entry = { kind: 'payment', gross, discounts: 0, fees: 0, points: 0, amount: sale.total, confirmedAt: sale.paidAt };
      checkPayment(entry);
      if (!validMoney(sale.cashReceived) || !validMoney(sale.change) || sale.cashReceived - sale.change !== sale.total) {
        throw reportError('Hóa đơn bắp nước không khớp tiền thu; cần đối soát.', 409);
      }
      include(entry, 'food');
    }
  }
  const result = {
    filters, timezone: REPORT_TIMEZONE, currency: 'VND', basis: BASIS,
    sourceNote: SOURCE_NOTE, dataTimestamp: dataTimestamp.toISOString(),
    totals, sources, series: Array.from(buckets.values()), excludedFoodSales
  };
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const report = await RevenueReport.create({ admin: adminId, result, expiresAt });
  return { reportId: report._id, expiresAt: expiresAt.toISOString(), ...result };
}
