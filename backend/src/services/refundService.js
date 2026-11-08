import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import User from '../models/User.js';
import PaymentAttempt from '../models/PaymentAttempt.js';
import RevenueEntry from '../models/RevenueEntry.js';
import PointRefund from '../models/PointRefund.js';
import { transaction, domainError as fail } from './transaction.js';
import { withScheduleWrite } from './showtimeService.js';

const POINT_VALUE = 1000;
const MINUTE = 60000;
const money = value => Number.isSafeInteger(value) && value >= 0;
const unused = booking => !booking.tickets.some(ticket => ticket.status === 'checked-in' || ticket.checkedInAt);
const summary = refund => ({ reference: refund.reference, kind: refund.kind, status: refund.status,
 rate: refund.rate, amount: refund.amount, points: refund.points, completedAt: refund.completedAt });

function checkId(id) { if (!mongoose.isObjectIdOrHexString(id)) throw fail('Mã đơn hoặc suất chiếu không hợp lệ.'); }
function checkReason(reason) {
 if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500) throw fail('Nhập lý do từ 3 đến 500 ký tự.');
 return reason.trim();
}
export async function requireRefundStaff(actorId, adminOnly = false, session = null) {
 const actor = await User.findOne({ _id: actorId, role: { $in: adminOnly ? ['admin'] : ['admin', 'employee'] }, status: { $in: ['Active', 'active'] } }).session(session);
 if (!actor) throw fail('Không có quyền xử lý hoàn điểm.', 403);
}

// Every whole VND is represented by 0.001 point; no repeated floating additions.
function pointUnits(balance) {
 const units = Math.round(balance * POINT_VALUE);
 if (!money(units) || Math.abs(balance * POINT_VALUE - units) > 0.001) throw fail('Số dư điểm không hợp lệ; cần đối soát.', 409);
 return units;
}

async function paidQuote(booking, kind, session = null) {
 if (!booking.user) throw fail('Khách vãng lai không được hoàn vé.', 409);
 if (booking.status !== 'paid' || booking.paymentStatus !== 'paid' || !unused(booking)) throw fail('Chỉ hoàn toàn bộ đơn đã thanh toán và chưa có vé nào check-in.', 409);
 if (await RevenueEntry.exists({ booking: booking._id, kind: 'refund' }).session(session)) throw fail('Đơn đã có chứng từ hoàn tiền; cần đối soát, không cộng điểm lần nữa.', 409);
 const entry = await RevenueEntry.findOne({ booking: booking._id, reference: booking.paymentRef, kind: 'payment' }).session(session);
 const attempt = await PaymentAttempt.findOne({ booking: booking._id, ref: booking.paymentRef, status: 'succeeded' }).session(session);
 if (!entry || !attempt || !['cash', 'vnpay', 'points'].includes(entry.method) || entry.method !== booking.paymentMethod ||
     entry.method !== attempt.method || entry.currency !== 'VND' || attempt.currency !== 'VND' || entry.amount !== booking.total || attempt.amount !== booking.total ||
     ![booking.total, booking.discount, booking.subtotal, booking.promotionDiscount || 0].every(money) ||
     booking.discount !== booking.pointsUsed * POINT_VALUE || booking.subtotal - (booking.promotionDiscount || 0) - booking.discount !== booking.total ||
     entry.gross !== booking.subtotal || entry.points !== booking.discount || entry.discounts !== (booking.promotionDiscount || 0) || entry.fees !== 0 ||
     entry.evidence !== (entry.method === 'cash' ? 'employee-receipt' : entry.method === 'points' ? 'points-ledger' : 'provider-confirmation') ||
     (entry.method === 'vnpay' && !attempt.providerRef)) throw fail('Chưa đủ chứng từ thanh toán để hoàn điểm. Liên hệ nhân viên đối soát.', 409);
 if (booking.pointsUsed) {
  const member = await User.findById(booking.user).select('+redemptionEntries').session(session);
  const debit = member?.redemptionEntries.filter(item => String(item.booking) === String(booking._id));
  if (!debit || debit.length !== 1 || debit[0].delta !== -booking.pointsUsed) throw fail('Chưa xác minh được điểm đã trừ của đơn.', 409);
 }
 const show = await Showtime.findById(booking.showtime).session(session);
 if (!show) throw fail('Không tìm thấy suất chiếu để xác minh hoàn vé.', 409);
 const startTime = new Date(booking.ticketContext?.startTime || show.startTime);
 if (startTime.getTime() !== show.startTime.getTime()) throw fail('Lịch chiếu đã thay đổi; cần nhân viên xử lý.', 409);
 let rate = 100;
 if (kind === 'member') {
  const remaining = startTime.getTime() - Date.now();
  if (show.cancelledAt) throw fail('Rạp đã hủy suất; hoàn điểm được xử lý theo chính sách hủy suất.', 409);
  if (remaining < 45 * MINUTE) throw fail('Chỉ nhận yêu cầu hoàn trước suất chiếu ít nhất 45 phút.', 409);
  rate = remaining >= 24 * 60 * MINUTE ? 100 : remaining >= 2 * 60 * MINUTE ? 80 : 50;
 }
 const base = booking.total + booking.discount;
 if (!money(base)) throw fail('Giá trị hoàn vượt giới hạn cho phép.', 409);
 const amount = Number(BigInt(base) * BigInt(rate) / 100n);
 const quote = { reference: booking.paymentRef, kind, method: entry.method, rate, base, amount, points: amount / POINT_VALUE };
 quote.quoteKey = createHash('sha256').update(JSON.stringify({ booking: String(booking._id), startTime, ...quote })).digest('hex');
 return { quote, startTime };
}

async function queuePaid(booking, kind, actorId, reason, session, expectedQuote) {
 const existing = await PointRefund.findOne({ reference: booking.paymentRef }).session(session);
 if (existing) return existing;
 const { quote, startTime } = await paidQuote(booking, kind, session);
 if (expectedQuote && quote.quoteKey !== expectedQuote) throw fail('Mức hoàn vừa thay đổi. Xem lại số điểm rồi xác nhận lại.', 409);
 const filter = { _id: booking._id, status: 'paid', paymentStatus: 'paid', tickets: { $not: { $elemMatch: { $or: [{ status: 'checked-in' }, { checkedInAt: { $ne: null } }] } } } };
 if (kind === 'member') {
  const deadline = new Date(startTime.getTime() - (quote.rate === 100 ? 24 * 60 : quote.rate === 80 ? 120 : 45) * MINUTE);
  filter.$expr = { $lte: ['$$NOW', deadline] };
 }
 const changed = await Booking.updateOne(filter, { $set: { status: 'refund-requested', refund: { ...summary(quote), status: 'pending' } } }, { session });
 if (changed.modifiedCount !== 1) throw fail('Đơn vừa thay đổi hoặc đã qua mốc hoàn. Vui lòng tải lại.', 409);
 const [request] = await PointRefund.create([{ ...quote, booking: booking._id, user: booking.user, actor: actorId, reason }], { session });
 return request;
}

export async function previewRefund(id, memberId) {
 checkId(id);
 const booking = await Booking.findOne({ _id: id, user: memberId });
 if (!booking) throw fail('Không tìm thấy đơn của bạn.', 404);
 if (booking.refund?.reference) return { eligible: false, refund: booking.refund, reason: 'Đơn đã có yêu cầu hoàn. Không gửi lại.' };
 try { return { eligible: true, ...(await paidQuote(booking, 'member')).quote }; }
 catch (error) { if (!error.status) throw error; return { eligible: false, reason: error.message }; }
}

// Claiming the booking and crediting the member are separate durable steps.
// A failed credit keeps Refund Requested, blocking check-in and staff retries.
export async function finalizeRefund(reference) {
 try {
  await transaction(async session => {
   const refund = await PointRefund.findOne({ reference }).session(session);
   if (!refund) throw fail('Không tìm thấy yêu cầu hoàn.', 404);
   if (refund.status === 'completed') return;
   const booking = await Booking.findById(refund.booking).session(session);
   const member = await User.findOne({ _id: refund.user, role: 'member' }).session(session);
   if (!booking || !member) throw fail('Thiếu đơn hoặc tài khoản nhận điểm; cần đối soát.', 409);
   const attempt = await PaymentAttempt.findOne({ ref: reference, booking: booking._id }).session(session);
   if (!attempt || attempt.status === 'returned' || attempt.status === 'refunded') throw fail('Khoản thu đã thay đổi; cần đối soát.', 409);
   const affectsBooking = refund.kind !== 'payment-failure' || booking.refund?.reference === reference;
   if (affectsBooking && (booking.status !== 'refund-requested' || !unused(booking))) throw fail('Trạng thái vé không cho phép hoàn.', 409);
   const before = pointUnits(member.memberPoints), after = before + refund.amount;
   if (!money(after)) throw fail('Số dư vượt giới hạn cho phép.', 409);
   const credit = await User.updateOne({ _id: member._id, memberPoints: member.memberPoints }, { $set: { memberPoints: after / POINT_VALUE } }, { session });
   if (credit.matchedCount !== 1) throw fail('Số dư điểm vừa thay đổi. Thử lại yêu cầu hoàn.', 409);
   refund.status = 'completed'; refund.balanceBefore = before / POINT_VALUE; refund.balanceAfter = after / POINT_VALUE;
   refund.completedAt = new Date(); refund.error = undefined; await refund.save({ session });
   if (refund.kind === 'payment-failure') {
    attempt.status = 'refunded'; attempt.message = 'Khoản thu đã hoàn 100% về điểm thành viên.';
    await attempt.save({ session });
   }
   if (affectsBooking) {
    booking.status = 'refunded'; booking.paymentStatus = 'refunded'; booking.refund = summary(refund);
    booking.activePayment = null; booking.paymentIssue = undefined;
    for (const ticket of booking.tickets) ticket.status = 'revoked';
    await booking.save({ session });
    await Showtime.updateOne({ _id: booking.showtime }, { $set: { 'seats.$[s].status': 'available', 'seats.$[s].bookingId': null, 'seats.$[s].holdUntil': null } },
     { session, arrayFilters: [{ 's.bookingId': booking._id, 's.status': { $in: ['held', 'booked'] } }] });
   } else if (booking.paymentIssue === 'Đang hoàn khoản thu dư về điểm.') {
    booking.paymentIssue = undefined; await booking.save({ session });
   }
  });
 } catch (error) {
  // Commit may have succeeded despite a lost response. Read before reporting.
  const current = await PointRefund.findOne({ reference });
  if (current?.status !== 'completed') {
   await PointRefund.updateOne({ reference, status: { $ne: 'completed' } }, { $set: { status: 'unresolved', error: 'Chưa xác nhận cộng điểm. Nhân viên cần thử lại; không hoàn thêm bằng tiền mặt hoặc VNPay.' } });
  }
 }
 const refund = await PointRefund.findOne({ reference }).lean();
 if (!refund) throw fail('Chưa xác nhận ghi nhận yêu cầu hoàn. Tải lại trạng thái trước khi thử lại.', 503);
 return refund;
}

export async function requestMemberRefund(id, memberId, quoteKey) {
 checkId(id);
 if (typeof quoteKey !== 'string' || !/^[a-f0-9]{64}$/.test(quoteKey)) throw fail('Xem số điểm được hoàn trước khi xác nhận.');
 const claimed = await transaction(async session => {
  const booking = await Booking.findOne({ _id: id, user: memberId }).session(session);
  if (!booking) throw fail('Không tìm thấy đơn của bạn.', 404);
  if (booking.refund?.reference) return { reference: booking.refund.reference, created: false };
  const refund = await queuePaid(booking, 'member', memberId, 'Member chủ động hoàn toàn bộ đơn', session, quoteKey);
  return { reference: refund.reference, created: true };
 });
 if (claimed.created) return finalizeRefund(claimed.reference);
 const existing = await PointRefund.findOne({ reference: claimed.reference }).lean();
 if (!existing) throw fail('Yêu cầu hoàn cần nhân viên đối soát.', 409);
 return existing;
}

async function queueFailedPayment(reference, actorId, reason, session) {
 const existing = await PointRefund.findOne({ reference }).session(session);
 if (existing) return existing;
 const attempt = await PaymentAttempt.findOne({ ref: reference }).session(session);
 if (!attempt || attempt.status !== 'unresolved' || attempt.currency !== 'VND' || !money(attempt.amount) || !attempt.amount ||
     (attempt.method === 'cash' ? !attempt.collectedAt || !attempt.actor || attempt.receivedAmount - attempt.change !== attempt.amount : attempt.method !== 'vnpay' || !attempt.providerRef || !attempt.collectedAt)) throw fail('Chưa có bằng chứng khoản thu thành công cần hoàn.', 409);
 const booking = await Booking.findById(attempt.booking).session(session);
 if (!booking?.user) throw fail('Khách vãng lai không được hoàn về điểm. Khoản thu vẫn cần đối soát.', 409);
 if (booking.paymentRef === reference && ['paid', 'refund-requested', 'refunded'].includes(booking.status)) throw fail('Khoản thu thuộc đơn đã hoàn tất; dùng quy trình hoàn vé.', 409);
 if (!['pending','cancelled','paid','refunded','refund-requested'].includes(booking.status) || booking.total !== attempt.amount) throw fail('Đơn đang được xử lý hoặc số tiền không khớp.', 409);
 const data = { reference, booking: booking._id, user: booking.user, kind: 'payment-failure', method: attempt.method,
  rate: 100, base: attempt.amount, amount: attempt.amount, points: attempt.amount / POINT_VALUE, actor: actorId, reason };
 // An extra charge for an already paid booking must not invalidate its tickets.
 if (['pending','cancelled'].includes(booking.status)) {
  booking.status = 'refund-requested'; booking.refund = { ...summary(data), status: 'pending' }; await booking.save({ session });
 } else {
  // Still write the booking to serialize this decision with settlement/refund.
  await Booking.updateOne({ _id: booking._id }, { $set: { paymentIssue: 'Đang hoàn khoản thu dư về điểm.' } }, { session });
 }
 const [refund] = await PointRefund.create([data], { session });
 return refund;
}

export async function refundFailedPayment(reference, actorId = null, reason = 'Đã thu tiền nhưng không hoàn tất đặt vé') {
 if (actorId) { await requireRefundStaff(actorId); reason = checkReason(reason); }
 await transaction(session => queueFailedPayment(reference, actorId, reason, session));
 return finalizeRefund(reference);
}

export async function cancelShowtime(id, input, actorId) {
 checkId(id); const reason = checkReason(input.reason);
 await requireRefundStaff(actorId, true);
 await withScheduleWrite(() => transaction(async session => {
  const show = await Showtime.findById(id).session(session);
  if (!show) throw fail('Không tìm thấy suất chiếu.', 404);
  if (show.cancelledAt) return;
  if (input.updatedAt !== show.updatedAt.toISOString()) throw fail('Suất chiếu đã thay đổi. Tải lại trước khi hủy.', 409);
  const bookings = await Booking.find({ showtime: id }).session(session);
  if (bookings.some(booking => !unused(booking))) throw fail('Suất đã có vé check-in. Chính sách hiện tại không cho hoàn đơn đã sử dụng.', 409);
  for (const booking of bookings) {
   booking.cinemaCancellation = { reason, at: new Date() }; await booking.save({ session });
   if (booking.status === 'refund-requested' && booking.refund?.reference) {
    const refund = await PointRefund.findOne({ reference: booking.refund.reference, status: { $ne: 'completed' }, kind: 'member' }).session(session);
    if (refund) {
     refund.kind = 'cinema'; refund.rate = 100; refund.amount = refund.base; refund.points = refund.base / POINT_VALUE;
     refund.reason = reason; refund.actor = actorId; await refund.save({ session });
     booking.refund = summary(refund); await booking.save({ session });
    }
   } else if (booking.status === 'paid' && booking.user && !['demo','mock'].includes(booking.paymentMethod)) {
    await queuePaid(booking, 'cinema', actorId, reason, session);
   } else if (booking.status === 'paid' || booking.status === 'pending') {
    booking.status = 'cancelled';
    for (const ticket of booking.tickets) ticket.status = 'revoked';
    await booking.save({ session });
    const receipts = await PaymentAttempt.find({ booking: booking._id, status: 'unresolved' }).session(session);
    if (booking.user) for (const receipt of receipts) {
     await queueFailedPayment(receipt.ref, actorId, reason, session);
    }
   }
  }
  show.cancelledAt = new Date(); show.cancellationReason = reason; show.cancelledBy = actorId;
  // Touch every affected booking above: a simultaneous check-in conflicts.
  await show.save({ session });
  await Showtime.updateOne({ _id: id }, { $set: { 'seats.$[s].status': 'available', 'seats.$[s].bookingId': null, 'seats.$[s].holdUntil': null } },
   { session, arrayFilters: [{ 's.status': 'held' }] });
 }));
 const bookingIds = await Booking.find({ showtime: id }).distinct('_id');
 const requests = await PointRefund.find({ booking: { $in: bookingIds }, status: { $ne: 'completed' } });
 for (const request of requests) await finalizeRefund(request.reference);
 const refunds = await PointRefund.find({ booking: { $in: bookingIds } }).lean();
 return { showtime: await Showtime.findById(id), completed: refunds.filter(item => item.status === 'completed').length,
  unresolved: refunds.filter(item => item.status !== 'completed').length,
  guests: await Booking.countDocuments({ showtime: id, user: null, paymentStatus: 'paid' }) };
}

export async function retryRefund(reference, actorId) {
 await requireRefundStaff(actorId);
 const refund = await PointRefund.findOne({ reference });
 if (!refund) throw fail('Không tìm thấy yêu cầu hoàn điểm.', 404);
 if (refund.status !== 'completed') await PointRefund.updateOne({ _id: refund._id, status: { $ne: 'completed' } }, { $push: { retries: { actor: actorId, at: new Date() } } });
 return finalizeRefund(reference);
}

export const listRefundIssues = () => PointRefund.find({ status: { $ne: 'completed' } })
 .populate('user', 'fullName email').populate('booking', 'seats showtime status').sort({ createdAt: -1 });
