import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Booking from "../../models/bookings/Booking.js";
import PaymentAttempt from "../../models/payments/PaymentAttempt.js";
import User from "../../models/users/User.js";
import { loadBooking, releaseSeats, settle, simulationFailure } from "../bookings/bookingService.js";
import { createPayment } from './vnpayService.js';
import { transaction, domainError as fail } from "../common/transaction.js";
import { refundFailedPayment } from './refundService.js';

async function requireStaff(actorId) {
 const actor = await User.findOne({ _id: actorId, role: { $in: ['admin', 'employee'] }, status: { $in: ['Active', 'active'] } });
 if (!actor) throw fail('Cần phiên nhân viên đang hoạt động.', 403);
}

// A failed finalization must retain the receipt, including an uncertain commit.
async function finishReceipt(attempt, actorId, reason) {
 try {
  return await settle(attempt.booking, {
   kind: attempt.method, ref: attempt.ref, actor: actorId, reason,
   verified: attempt.method === 'vnpay' && !!attempt.providerRef, providerRef: attempt.providerRef
  });
 } catch (error) {
  const latest = await loadBooking(attempt.booking);
  if (latest?.status === 'paid' && latest.paymentRef === attempt.ref) return latest;
  const message = error.status ? error.message : 'Chưa xác nhận hoàn tất khoản thu. Cần đối soát, không thu tiền lần nữa.';
  const update = { $set: { status: 'unresolved', message } };
  if (reason) update.$push = { reconciliation: { action: 'retry', reason, actor: actorId, at: new Date() } };
  await PaymentAttempt.updateOne({ ref: attempt.ref, status: { $in: ['created', 'unresolved'] } }, update);
  await Booking.updateOne({ _id: attempt.booking, status: 'pending', activePayment: attempt.ref }, { $set: { paymentIssue: message } });
  if (latest?.user) {
   try { await refundFailedPayment(attempt.ref); }
   catch { /* Retain the verified receipt for staff reconciliation. */ }
  }
  return loadBooking(attempt.booking);
 }
}

async function receiveCash(id, input, actorId) {
 const ref = await transaction(async session => {
  const booking = await Booking.findById(id).session(session);
  if (!booking) throw fail('Không tìm thấy đơn.', 404);
  if (booking.status === 'paid') return null;
  if (booking.status !== 'pending' || !booking.expiresAt || booking.expiresAt <= new Date()) throw fail('Đơn đã hủy hoặc hết hạn; chưa ghi nhận thu tiền.', 410);
  if (booking.activePayment) {
   const previous = await PaymentAttempt.findOne({ ref: booking.activePayment }).session(session);
   if (previous?.method === 'cash' && previous.collectedAt && previous.status === 'unresolved') return previous.ref;
   throw fail('Đơn đang có giao dịch thanh toán. Kiểm tra kết quả trước khi thu thêm.', 409);
  }
  if (booking.paymentProcessing) throw fail('Đơn đang xử lý thanh toán.', 409);
  if (!Number.isSafeInteger(input.receivedAmount) || input.receivedAmount < booking.total || booking.total <= 0) throw fail('Tiền khách đưa phải là số nguyên và không nhỏ hơn tổng đơn.', 403);
  // Older clients may confirm the exact amount; change requires the accepted total.
  if ((input.confirmedTotal !== undefined && input.confirmedTotal !== booking.total) ||
      (input.receivedAmount > booking.total && input.confirmedTotal !== booking.total)) throw fail('Tổng đơn đã thay đổi. Kiểm tra lại số tiền trước khi xác nhận thu.', 409);
  const receipts = await PaymentAttempt.create([{
   ref: crypto.randomUUID(), booking: booking._id, method: 'cash', status: 'unresolved',
   amount: booking.total, receivedAmount: input.receivedAmount, change: input.receivedAmount - booking.total,
   actor: actorId, collectedAt: new Date(), expiresAt: booking.expiresAt
  }], { session });
  const receipt = receipts[0];
  booking.activePayment = receipt.ref; booking.cashReceived = receipt.receivedAmount;
  booking.change = receipt.change; booking.paymentIssue = undefined;
  await booking.save({ session });
  return receipt.ref;
 });
 if (!ref) return loadBooking(id);
 const receipt = await PaymentAttempt.findOne({ ref });
 return finishReceipt(receipt, actorId);
}

export async function payStaffBooking(id, input, actorId, ip) {
 await requireStaff(actorId);
 if (!mongoose.isObjectIdOrHexString(id)) throw fail('Mã đơn không hợp lệ.');
 const method = input.method || 'cash';
 if (!['cash', 'vnpay', 'points', 'demo'].includes(method)) throw fail('Phương thức thanh toán chưa được hỗ trợ.');
 const booking = await Booking.findById(id);
 if (!booking) throw fail('Không tìm thấy đơn.', 404);
 if (booking.status === 'paid') return loadBooking(id);
 if (!Number.isSafeInteger(booking.total) || booking.total < 0) throw fail('Tổng đơn không hợp lệ. Cần kiểm tra lại trước khi thu tiền.', 409);
 if (method === 'demo' && input.result === 'failed') return simulationFailure(id);
 if (booking.total === 0) {
  if (Number(input.receivedAmount || 0) !== 0) throw fail('Đơn 0đ không thu thêm tiền.');
  return settle(id, { kind: 'points', actor: actorId });
 }
 if (method === 'vnpay') {
  const payment = await createPayment(id, null, ip, actorId, input.mobileReturnTo || null);
  return { ...payment, booking: await loadBooking(id) };
 }
 if (method === 'points') throw fail('Số tiền còn lại phải bằng 0 để xác nhận đơn bằng điểm.');
 if (method === 'demo') return settle(id, { kind: 'demo', actor: actorId, receivedAmount: input.receivedAmount });
 return receiveCash(id, input, actorId);
}

export function listReconciliation() {
 return PaymentAttempt.find({ status: 'unresolved' })
  .populate({ path: 'booking', select: 'user status paymentRef total expiresAt showtime seats activePayment refund', populate: { path: 'showtime', select: 'movie cinema room startTime', populate: { path: 'movie', select: 'title' } } })
  .populate({ path: 'actor', select: 'fullName email' }).sort({ createdAt: -1 });
}

export async function reconcilePayment(ref, input, actorId) {
 await requireStaff(actorId);
 if (!['retry', 'cash-returned', 'refund-points', 'note'].includes(input.action) || typeof input.reason !== 'string' || input.reason.trim().length < 3 || input.reason.length > 500) throw fail('Chọn tác vụ và nhập lý do từ 3 đến 500 ký tự.');
 const reason = input.reason.trim();
 const receipt = await PaymentAttempt.findOne({ ref });
 if (!receipt) throw fail('Không tìm thấy khoản thu.', 404);
 if (input.action === 'refund-points') {
  const refund = await refundFailedPayment(ref, actorId, reason);
  return { booking: await loadBooking(receipt.booking), refund, message: refund.status === 'completed' ? 'Đã hoàn 100% khoản thu về điểm thành viên.' : 'Đã ghi nhận yêu cầu; cần thử lại cộng điểm trong mục hoàn điểm.' };
 }
 if (input.action === 'retry') {
  if (receipt.status === 'succeeded') return { booking: await loadBooking(receipt.booking), message: 'Khoản thu đã hoàn tất trước đó.' };
  if (receipt.status !== 'unresolved' || (receipt.method === 'cash' ? !receipt.collectedAt : receipt.method !== 'vnpay' || !receipt.providerRef)) throw fail('Khoản thu chưa có bằng chứng hợp lệ để hoàn tất.', 409);
  const booking = await finishReceipt(receipt, actorId, reason);
  return { booking, message: booking?.refund?.status === 'completed' ? 'Khoản thu đã hoàn về điểm thành viên.' : booking?.status === 'paid' && booking.paymentRef === ref ? 'Đã hoàn tất khoản thu, không thu tiền lần nữa.' : 'Chưa thể hoàn tất. Khoản thu vẫn chờ đối soát.' };
 }
 await transaction(async session => {
  const current = await PaymentAttempt.findOne({ ref }).session(session);
  if (input.action === 'cash-returned' && current.status === 'returned') return;
  if (current.status !== 'unresolved') throw fail('Khoản thu vừa được xử lý. Vui lòng tải lại.', 409);
  if (input.action === 'cash-returned') {
   if (current.method !== 'cash' || !current.collectedAt) throw fail('Chỉ xác nhận trả lại tiền mặt đã nhận cho đơn chưa hoàn tất.');
   const booking = await Booking.findById(current.booking).session(session);
   if (booking?.status === 'paid' && booking.paymentRef === ref) throw fail('Đơn đã thanh toán thành công. Hoàn vé thuộc quy trình khác.', 409);
   if (booking?.user) throw fail('Khoản thu của Member phải hoàn về điểm; không xác nhận trả tiền mặt.', 409);
   if (input.returnedAmount !== current.amount) throw fail('Tiền trả lại phải bằng khoản thực thu sau khi đã trả tiền thừa.');
   current.status = 'returned';
   if (booking?.activePayment === ref) {
    booking.activePayment = null; booking.paymentIssue = 'Khoản tiền mặt chưa hoàn tất đã được trả lại khách.';
    if (booking.status === 'pending') {
     booking.status = 'cancelled'; booking.paymentStatus = 'failed';
     await releaseSeats(booking, session);
    }
    await booking.save({ session });
   }
  }
  current.reconciliation.push({ action: input.action, reason, actor: actorId, at: new Date() });
  await current.save({ session });
 });
 return { booking: await loadBooking(receipt.booking), message: input.action === 'cash-returned' ? 'Đã ghi nhận trả lại khoản thực thu bằng tiền mặt.' : 'Đã lưu ghi chú. Khoản thu vẫn chờ xác minh; chưa được đánh dấu hoàn tiền.' };
}
