import mongoose from 'mongoose';
import FoodSale from '../../models/catalogue/FoodSale.js';
import Food from '../../models/catalogue/Food.js';
import Booking from '../../models/bookings/Booking.js';
import User from '../../models/users/User.js';
import { loadBooking } from '../bookings/bookingService.js';
import { transaction, domainError as fail } from '../common/transaction.js';
import { consumeFoodPromotion } from './foodSalePromotionService.js';

async function requireStaff(actorId) {
  if (!await User.exists({ _id: actorId, role: { $in: ['admin', 'employee'] }, status: { $in: ['Active', 'active'] } })) throw fail('Cần phiên nhân viên đang hoạt động.', 403);
}
export async function lookupStaffOrder(id, actorId) {
  await requireStaff(actorId);
  if (!mongoose.isObjectIdOrHexString(id)) throw fail('Mã đơn phải gồm 24 ký tự chữ số và chữ cái a–f.');
  if (await Booking.exists({ _id: id })) return { type: 'booking', order: await loadBooking(id) };
  const sale = await FoodSale.findById(id).populate('employee', 'fullName email');
  if (!sale) throw fail('Không tìm thấy đơn vé hoặc đơn F&B với mã này.', 404);
  return { type: 'food-sale', order: sale };
}
export async function listFoodSaleReconciliation(actorId) {
  await requireStaff(actorId);
  return FoodSale.find({ status: { $in: ['payment_received', 'reconciliation'] } }).populate('employee', 'fullName email').sort({ updatedAt: -1 });
}
export async function reconcileFoodSale(id, input, actorId) {
  await requireStaff(actorId);
  if (!mongoose.isObjectIdOrHexString(id)) throw fail('Mã đơn F&B không hợp lệ.');
  if (!input || !['retry', 'note', 'cash-returned'].includes(input.action) || typeof input.reason !== 'string' || input.reason.trim().length < 3 || input.reason.length > 500) throw fail('Chọn tác vụ và nhập lý do từ 3 đến 500 ký tự.');
  const reason = input.reason.trim();
  await transaction(async session => {
    const sale = await FoodSale.findById(id).session(session);
    if (!sale) throw fail('Không tìm thấy đơn F&B.', 404);
    if (input.action === 'retry' && sale.status === 'paid') return;
    if (input.action === 'cash-returned' && sale.status === 'returned' && input.returnedAmount === sale.returnedAmount) return;
    if (!['payment_received', 'reconciliation'].includes(sale.status)) throw fail('Đơn không có khoản thu cần đối soát. Tải lại để kiểm tra trạng thái.', 409);
    if (input.action !== 'note') {
      const cashProof = sale.paymentMethod === 'cash' && Number.isSafeInteger(sale.cashReceived) && sale.cashReceived >= sale.total && sale.change === sale.cashReceived - sale.total;
      const onlineProof = sale.paymentMethod === 'vnpay' && sale.onlinePayment?.collectedAt && sale.onlinePayment?.providerRef;
      if (!sale.paymentConfirmedAt || !Number.isSafeInteger(sale.total) || sale.total < 0 || (!cashProof && !onlineProof)) throw fail('Đơn thiếu bằng chứng nhận tiền hợp lệ. Chỉ lưu ghi chú để kiểm tra.', 409);
      if (input.action === 'retry') {
        if (!sale.items.length || new Set(sale.items.map(item => String(item.food))).size !== sale.items.length || sale.items.some(item => !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1) || sale.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) - (sale.promotionDiscount || 0) !== sale.total) throw fail('Chi tiết giá đơn không nhất quán. Cần kiểm tra trước khi hoàn tất.', 409);
        await consumeFoodPromotion(sale, session);
        for (const item of sale.items) {
          const result = await Food.updateOne({ _id: item.food, available: true, deletedAt: null, price: item.unitPrice, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity, __v: 1 } }, { session });
          if (result.modifiedCount !== 1) throw fail('Giá hoặc tồn kho chưa phù hợp với đơn. Kiểm tra danh mục hoặc trả lại khoản đã thu; không thu thêm tiền.', 409);
        }
        sale.status = 'paid'; sale.paidAt = new Date(); sale.issue = undefined;
        if (onlineProof) sale.onlinePayment.status = 'succeeded';
      } else {
        if (onlineProof) throw fail('Khoản VNPay cần hoàn qua cổng thanh toán; không xác nhận trả tiền mặt tại đây.', 409);
        if (input.returnedAmount !== sale.total) throw fail('Chỉ xác nhận trả lại khoản thực thu bằng tổng đơn, không cộng lại tiền thừa.');
        sale.status = 'returned'; sale.returnedAmount = sale.total; sale.returnedAt = new Date(); sale.issue = undefined;
      }
    }
    sale.reconciliation.push({ action: input.action, reason, actor: actorId, at: new Date() });
    await sale.save({ session });
  });
  const order = await FoodSale.findById(id).populate('employee', 'fullName email');
  return { order, message: input.action === 'retry' ? 'Đã hoàn tất đơn F&B từ khoản tiền đã nhận, không thu tiền lần nữa.' : input.action === 'cash-returned' ? 'Đã ghi nhận trả lại khoản thực thu cho khách. Không trừ tồn kho.' : 'Đã lưu ghi chú đối soát F&B.' };
}
