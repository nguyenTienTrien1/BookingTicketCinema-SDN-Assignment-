import { createHash } from 'node:crypto';
import Promotion from "../../models/catalogue/Promotion.js";
import { domainError as fail } from "../common/transaction.js";

// Shared online/counter policy: one code/order, scoped minimum, floor to VND,
// promotion before points; only stackable promotions may accompany points.
// Keep the existing policy ID so previously quoted counter orders stay valid.
export const COUNTER_PROMOTION_POLICY = 'counter-v1';

export function normalizePromotionCode(code) {
  if (typeof code !== 'string' || code.length > 80) throw fail('Mã khuyến mãi không hợp lệ.');
  const normalized = code.trim().toUpperCase();
  if (normalized && !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(normalized)) throw fail('Mã khuyến mãi phải gồm 3–40 chữ cái, chữ số, dấu gạch ngang hoặc gạch dưới.');
  return normalized;
}

function money(value) { return Number.isSafeInteger(value) && value >= 0; }

function signature(promotion) {
  return createHash('sha256').update(JSON.stringify([
    promotion.code, promotion.discountType, promotion.value, promotion.minOrder,
    promotion.maxDiscount ?? null, promotion.scope, promotion.stackable,
    promotion.startsAt.getTime(), promotion.endsAt.getTime(), promotion.usageLimit ?? null,
    COUNTER_PROMOTION_POLICY,
  ])).digest('hex');
}

export async function quoteCounterPromotion(code, booking, session) {
  code = normalizePromotionCode(code);
  if (!code) return { promotion: undefined, discount: 0 };
  const now = new Date();
  const promotion = await Promotion.findOne({ code, active: true, deletedAt: null }).session(session);
  if (!promotion || !Number.isFinite(promotion.startsAt?.getTime()) || !Number.isFinite(promotion.endsAt?.getTime()) || promotion.startsAt > now || promotion.endsAt <= now) throw fail('Mã khuyến mãi không tồn tại, chưa bắt đầu hoặc đã hết hạn.', 409);
  if (promotion.usageLimit != null && promotion.usedCount >= promotion.usageLimit) throw fail('Mã khuyến mãi đã hết lượt sử dụng.', 409);
  if (!['food', 'ticket', 'all'].includes(promotion.scope) || !['fixed', 'percentage'].includes(promotion.discountType) ||
      !money(promotion.value) || promotion.value < 1 || !money(promotion.minOrder) ||
      (promotion.maxDiscount != null && (!money(promotion.maxDiscount) || promotion.maxDiscount < 1)) ||
      (promotion.discountType === 'percentage' && promotion.value > 100) || typeof promotion.stackable !== 'boolean') {
    throw fail('Cấu hình mã khuyến mãi chưa hợp lệ. Vui lòng liên hệ quản trị viên.', 409);
  }
  if (!money(booking.ticketPrice) || !booking.seats.length || booking.foodItems.some(item => !money(item.unitPrice) || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    throw fail('Đơn thiếu thông tin giá đã xác nhận. Vui lòng tạo đơn mới.', 409);
  }
  const tickets = booking.ticketPrice * booking.seats.length;
  const food = booking.foodItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  if (![tickets, food, booking.subtotal].every(money) || tickets + food !== booking.subtotal) throw fail('Thông tin giá của đơn không còn nhất quán.', 409);
  const eligibleAmount = promotion.scope === 'food' ? food : promotion.scope === 'ticket' ? tickets : booking.subtotal;
  if (!eligibleAmount || eligibleAmount < promotion.minOrder) throw fail('Phần được giảm chưa đạt giá trị tối thiểu của mã khuyến mãi.', 409);
  if (!promotion.stackable && booking.pointsUsed > 0) throw fail('Mã này không dùng đồng thời với điểm. Bỏ mã hoặc đặt điểm về 0.', 409);
  const raw = promotion.discountType === 'fixed' ? promotion.value : Number(BigInt(eligibleAmount) * BigInt(promotion.value) / 100n);
  const discount = Math.min(raw, promotion.maxDiscount ?? eligibleAmount, eligibleAmount);
  return {
    record: promotion,
    discount,
    promotion: {
      promotion: promotion._id, code: promotion.code, name: promotion.name,
      scope: promotion.scope, discountType: promotion.discountType, value: promotion.value,
      minOrder: promotion.minOrder, maxDiscount: promotion.maxDiscount, stackable: promotion.stackable,
      eligibleAmount, discount, ruleSignature: signature(promotion), policy: COUNTER_PROMOTION_POLICY,
    },
  };
}

export async function consumeCounterPromotion(booking, session) {
  if (!booking.promotion) {
    if (booking.promotionDiscount) throw fail('Đơn thiếu mã khuyến mãi tương ứng với số tiền giảm.', 409);
    return;
  }
  if (booking.expiresAt <= new Date()) throw fail('Giữ ghế đã hết hạn. Không thể hoàn tất thanh toán.', 410);
  const quote = await quoteCounterPromotion(booking.promotion.code, booking, session);
  if (String(quote.promotion.promotion) !== String(booking.promotion.promotion) ||
      quote.promotion.ruleSignature !== booking.promotion.ruleSignature ||
      quote.promotion.policy !== booking.promotion.policy || quote.discount !== booking.promotionDiscount ||
      quote.discount !== booking.promotion.discount || quote.promotion.eligibleAmount !== booking.promotion.eligibleAmount ||
      booking.discount !== booking.pointsUsed * 1000 || booking.total !== booking.subtotal - booking.discount - quote.discount || !money(booking.total)) {
    throw fail('Khuyến mãi hoặc giá đơn đã thay đổi. Áp dụng lại mã và xác nhận tổng tiền mới trước khi thanh toán.', 409);
  }
  const now = new Date();
  const filter = { _id: quote.record._id, active: true, deletedAt: null,
    __v: { $in: [quote.record.__v || 0, null] }, startsAt: { $lte: now }, endsAt: { $gt: now } };
  if (quote.record.usageLimit != null) filter.$expr = { $lt: [{ $ifNull: ['$usedCount', 0] }, quote.record.usageLimit] };
  const updated = await Promotion.updateOne(filter, { $inc: { usedCount: 1, __v: 1 } }, { session });
  if (updated.modifiedCount !== 1) throw fail('Khuyến mãi vừa thay đổi hoặc hết lượt. Vui lòng kiểm tra lại đơn.', 409);
}
