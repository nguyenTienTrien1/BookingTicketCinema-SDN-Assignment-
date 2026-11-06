import mongoose from 'mongoose';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import Food from '../models/Food.js';
import User from '../models/User.js';
import PaymentAttempt from '../models/PaymentAttempt.js';
import { transaction, domainError as fail } from './transaction.js';
import { withScheduleWrite } from './showtimeService.js';
import { quoteCounterPromotion, consumeCounterPromotion } from './counterPromotionService.js';
export const POINT_VALUE = 1000;
export function validatePoints(points, subtotal, balance) {
 const step = Number(process.env.POINT_REDEEM_STEP || 100);
 if (!Number.isSafeInteger(points) || points < 0 || points % step !== 0 || points > balance || points * POINT_VALUE > subtotal) throw fail('Điểm sử dụng không hợp lệ hoặc vượt số dư/giá trị đơn.');
}
const populate = [{ path: 'showtime', populate: { path: 'movie' } }, { path: 'foodItems.food' }, { path: 'user', select: 'fullName email role memberPoints status' }];
async function reprice(booking, member, session, code = booking.promotion?.code || '') {
 const quote = await quoteCounterPromotion(code, booking, session);
 validatePoints(booking.pointsUsed, booking.subtotal - quote.discount, member?.memberPoints || 0);
 booking.promotion = quote.promotion; booking.promotionDiscount = quote.discount;
 booking.discount = booking.pointsUsed * POINT_VALUE;
 booking.total = booking.subtotal - booking.discount - quote.discount;
}
export const loadBooking = (id) => Booking.findById(id).populate(populate);
export async function releaseSeats(booking, session) {
 await Showtime.updateOne({ _id: booking.showtime }, { $set: { 'seats.$[s].status': 'available', 'seats.$[s].bookingId': null, 'seats.$[s].holdUntil': null } }, { session, arrayFilters: [{ 's.bookingId': booking._id, 's.status': 'held' }] });
}
export async function expireBookings() {
 const expired = await Booking.find({ status: 'pending', expiresAt: { $lte: new Date() } }).select('_id').limit(100);
 for (const item of expired) await transaction(async (session) => {
  const b = await Booking.findOne({ _id: item._id, status: 'pending', expiresAt: { $lte: new Date() } }).session(session);
  if (!b) return;
  b.status = 'cancelled'; b.paymentStatus = 'failed'; await b.save({ session }); await releaseSeats(b, session);
 });
}
async function foodSnapshot(items, session) {
 if (!Array.isArray(items)) throw fail('Danh sách món không hợp lệ.');
 const seen = new Set(), result = []; let total = 0;
 for (const item of items) {
  if (!item || !mongoose.isObjectIdOrHexString(item.food) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || seen.has(String(item.food))) throw fail('Món hoặc số lượng không hợp lệ/trùng lặp.');
  seen.add(String(item.food));
  const f = await Food.findOne({ _id: item.food, available: true, deletedAt: null, stock: { $gte: item.quantity } }).session(session);
  if (!f) throw fail('Món đã ngừng bán hoặc không đủ tồn kho.', 409);
  result.push({ food: f._id, name: f.name, unitPrice: f.price, quantity: item.quantity }); total += f.price * item.quantity;
 }
 return { items: result, total };
}
async function checkAge(movie, member, actor, guardian) {
 if (!movie || movie.deletedAt || movie.classification === 'C') throw fail('Phim không được phép bán vé.');
 const required = { T13: 13, T16: 16, T18: 18 }[movie.classification] || movie.ageLimit || 0;
 if (actor) {
  if ((required > 0 || movie.classification === 'K') && guardian !== true) throw fail('Nhân viên cần xác nhận kiểm tra tuổi/điều kiện người giám hộ.');
 }
}
export async function createBooking(data) {
 return withScheduleWrite(function () { return createBookingWithGuard(data); });
}
async function createBookingWithGuard({ userId, showtimeId, seats, foodItems = [], counterEmployee = null, points = 0, guardianConfirmed = false, promotionCode = '' }) {
 await expireBookings();
 if (!mongoose.isObjectIdOrHexString(showtimeId) || (!counterEmployee && !mongoose.isObjectIdOrHexString(userId)) || !Array.isArray(seats) || !seats.length || seats.some(s => typeof s !== 'string' && typeof s !== 'number') || new Set(seats.map(String)).size !== seats.length) throw fail('Dữ liệu đặt vé không hợp lệ.');
 const snapshot = await Showtime.findById(showtimeId).lean();
 if (!snapshot) throw fail('Không tìm thấy suất chiếu.',404);
 const id = await transaction(async (session) => {
  const show = await Showtime.findById(showtimeId).session(session);
  if (!show || show.startTime <= new Date()) throw fail('Suất chiếu không còn mở bán.', 409);
  if(show.price!==snapshot.price||String(show.movie)!==String(snapshot.movie)||show.cinema!==snapshot.cinema||show.room!==snapshot.room||show.startTime.getTime()!==snapshot.startTime.getTime())throw fail('Giá hoặc lịch chiếu vừa thay đổi. Vui lòng chọn lại.',409);
  const movie = await Movie.findById(show.movie).session(session);
  const member = userId ? await User.findOne({ _id: userId, role: 'member', status: { $in: ['Active','active'] } }).session(session) : null;
  if (userId && !member) throw fail('Không tìm thấy Member đang hoạt động.');
  await checkAge(movie, member, counterEmployee, guardianConfirmed);
  const food = await foodSnapshot(foodItems, session);
  const subtotal = show.price * seats.length + food.total;
  validatePoints(points, subtotal, member?.memberPoints || 0);
  const b = new Booking({ user: userId || null, counterEmployee, showtime: show._id, seats: seats.map(String), ticketPrice: show.price, foodItems: food.items, subtotal, pointsUsed: points, discount: points * POINT_VALUE, total: subtotal - points * POINT_VALUE, expiresAt: new Date(Date.now() + 600000), ageCheckedBy: counterEmployee, guardianConfirmed });
  await reprice(b, member, session, promotionCode);
  // Operational condition is independent of available/held/booked. Missing
  // condition on a legacy snapshot means Active, never a VIP price override.
  const claim = await Showtime.updateOne({ _id: show._id, $and: b.seats.map(number => ({ seats: { $elemMatch: { number, status: 'available', condition: { $in: ['Active', null] } } } })) }, { $set: { 'seats.$[s].status': 'held', 'seats.$[s].bookingId': b._id, 'seats.$[s].holdUntil': b.expiresAt } }, { session, arrayFilters: [{ 's.number': { $in: b.seats }, 's.status': 'available', 's.condition': { $in: ['Active', null] } }] });
  if (claim.modifiedCount !== 1) throw fail('Ghế vừa được giữ/bán. Vui lòng chọn lại.', 409);
  await b.save({ session }); return b._id;
 }); return loadBooking(id);
}
import Movie from '../models/Movie.js';
async function pending(id, userId, session) {
 const b = await Booking.findOne({ _id: id, user: userId }).session(session);
 if (!b) throw fail('Không tìm thấy đơn.', 404);
 if (b.status !== 'pending' || b.expiresAt <= new Date()) throw fail('Đơn không còn được phép chỉnh sửa.', 410);
 if (b.activePayment || b.paymentProcessing) throw fail('Đơn đang có giao dịch VNPay. Hủy giao dịch trước khi sửa.', 409);
 return b;
}
export async function applyMemberPoints(id, userId, points) {
 await transaction(async (session) => {
  const b = await pending(id, userId, session);
  const u = userId && await User.findOne({ _id: userId, role: 'member', status: { $in: ['Active','active'] } }).session(session);
  if (!u) throw fail('Khách vãng lai không được dùng điểm.');
  b.pointsUsed = points; await reprice(b, u, session); await b.save({ session });
 }); return loadBooking(id);
}
export async function updateFoods(id, userId, items) {
 await transaction(async (session) => { const b = await pending(id, userId, session); const f = await foodSnapshot(items, session); if(!Number.isFinite(b.ticketPrice))throw fail('Đơn cũ thiếu snapshot giá vé. Vui lòng hủy và đặt lại.',409); const subtotal = b.ticketPrice * b.seats.length + f.total;
  const u = b.user && await User.findById(b.user).session(session);
  b.foodItems = f.items; b.subtotal = subtotal; await reprice(b, u, session); await b.save({ session });
 }); return loadBooking(id);
}
export async function applyCounterPromotion(id, userId, code) {
 await transaction(async session => {
  const b = await pending(id, userId, session);
  if (!b.counterEmployee) throw fail('Chỉ áp dụng khuyến mãi cho đơn tại quầy.', 403);
  const member = b.user && await User.findById(b.user).session(session);
  await reprice(b, member, session, code); await b.save({ session });
 }); return loadBooking(id);
}
export async function cancelBooking(id, userId) {
 await transaction(async (session) => { const b = await Booking.findOne({ _id: id, user: userId }).session(session); if (!b) throw fail('Không tìm thấy đơn.', 404); if (b.status === 'paid') throw fail('Vé đã thanh toán không thể hủy giữ ghế.'); if (b.status === 'cancelled') return; b.status = 'cancelled'; b.paymentStatus = 'failed'; await b.save({ session }); await releaseSeats(b, session); }); return loadBooking(id);
}
// Trusted server-only finalization. Client routes cannot pass settlement evidence.
export async function settle(id, evidence) {
 const result = await transaction(async (session) => {
  const b = await Booking.findById(id).session(session); if (!b) throw fail('Không tìm thấy đơn.', 404);
  if (b.status === 'paid') {
   if(evidence.kind==='vnpay'&&(!evidence.verified||b.paymentMethod!=='vnpay'||b.paymentRef!==evidence.ref))throw fail('Đơn đã thanh toán bằng giao dịch khác; cần đối soát khoản thu này.',409);
   return b._id;
  }
  if (b.status !== 'pending' || b.expiresAt <= new Date()) throw fail('Đơn đã hủy hoặc hết hạn.', 410);
  const show = await Showtime.findById(b.showtime).session(session); if (!show || show.startTime <= new Date()) throw fail('Suất đã bắt đầu.', 409);
  const finalMovie = await Movie.findById(show.movie).session(session);
  const finalMember = b.user ? await User.findById(b.user).session(session) : null;
  await checkAge(finalMovie, finalMember, b.counterEmployee, b.guardianConfirmed);
  let attempt;
  if (evidence.kind === 'vnpay') {
   attempt = await PaymentAttempt.findOne({ ref: evidence.ref, booking: b._id, status: { $in: ['created','unresolved'] }, amount: b.total, currency: 'VND' }).session(session);
   if (!attempt || !evidence.verified || b.activePayment !== attempt.ref) throw fail('Bằng chứng thanh toán không hợp lệ.', 409);
  } else if (b.activePayment) throw fail('Đơn đang có giao dịch VNPay.', 409);
  if (evidence.kind === 'points' && b.total !== 0) throw fail('Chỉ xác nhận bằng điểm khi số tiền còn lại bằng 0.');
  if (evidence.kind === 'cash') {
   const actor = await User.findOne({ _id: evidence.actor, role: { $in: ['admin','employee'] }, status: { $in: ['Active','active'] } }).session(session);
   if (!actor || evidence.receivedAmount !== b.total || b.total <= 0) throw fail('Nhân viên cần xác nhận đúng số tiền thực thu.', 403);
   if (actor.role !== 'admin' && b.counterEmployee && String(b.counterEmployee) !== String(actor._id)) throw fail('Không có quyền xử lý đơn này.', 403);
  }
  if (evidence.kind === 'demo' && (process.env.NODE_ENV === 'production' || process.env.ENABLE_PAYMENT_SIMULATION !== 'true')) throw fail('Thanh toán giả lập chưa được bật cho môi trường development.',403);
  if (!['demo','cash','points','vnpay'].includes(evidence.kind)) throw fail('Phương thức không được hỗ trợ.');
  if (b.user) {
   const member = await User.findOne({ _id: b.user, role: 'member', status: { $in: ['Active','active'] } }).session(session);
   if (!member || member.memberPoints < b.pointsUsed) throw fail('Số dư điểm đã thay đổi hoặc tài khoản bị khóa.', 409);
   if (b.pointsUsed) await User.updateOne({ _id: b.user, memberPoints: { $gte: b.pointsUsed } }, { $inc: { memberPoints: -b.pointsUsed }, $push: { redemptionEntries: { booking: b._id, delta: -b.pointsUsed, at: new Date() } } }, { session });
  } else if (b.pointsUsed) throw fail('Đơn vãng lai không được dùng điểm.');
  for (const item of b.foodItems) { const stock = await Food.updateOne({ _id: item.food, available: true, deletedAt: null, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { session }); if (stock.modifiedCount !== 1) throw fail('Món đã hết hàng, chưa thể hoàn tất thanh toán.', 409); }
  const sold = await Showtime.updateOne({ _id: b.showtime, $and: b.seats.map(number => ({ seats: { $elemMatch: { number, status: 'held', bookingId: b._id, holdUntil: { $gt: new Date() } } } })) }, { $set: { 'seats.$[s].status': 'booked', 'seats.$[s].holdUntil': null } }, { session, arrayFilters: [{ 's.bookingId': b._id, 's.status': 'held' }] });
  if (sold.modifiedCount !== 1) throw fail('Giữ ghế không còn hợp lệ.', 409);
  const issuedAt = new Date();
  b.ticketMode = evidence.kind === 'demo' ? 'demo' : 'verified';
  b.ticketContext = { startTime: show.startTime, cinema: show.cinema, room: show.room, movieTitle: finalMovie.title, classification: finalMovie.classification || '', ageLimit: finalMovie.ageLimit || 0 };
  b.tickets = []; for (const seat of b.seats) { const code = crypto.randomBytes(24).toString('hex'); b.tickets.push({ seat, code, reference: code, qr: await QRCode.toDataURL(JSON.stringify({ ticket: code, booking: String(b._id), seat }), { width: 220, margin: 1 }), status: 'valid', issuedAt }); }
  await consumeCounterPromotion(b, session);
  if (!attempt) { const created = await PaymentAttempt.create([{ ref: crypto.randomUUID(), booking: b._id, amount: b.total, method: evidence.kind, status: 'succeeded', receivedAmount: evidence.receivedAmount, actor: evidence.actor }], { session }); attempt = created[0]; }
  else { attempt.status = 'succeeded'; attempt.providerRef = evidence.providerRef; await attempt.save({ session }); }
  b.status = 'paid'; b.paymentStatus = 'paid'; b.paymentMethod = evidence.kind; b.paymentRef = attempt.ref; b.activePayment = null; b.paidAt = new Date(); await b.save({ session }); return b._id;
 }); return loadBooking(result);
}
export async function pay() { throw fail('Không chấp nhận xác nhận thanh toán từ trình duyệt.', 403); }
export const listBookings = (userId) => Booking.find({ user: userId })
 .select('showtime seats ticketPrice foodItems subtotal pointsUsed discount promotion promotionDiscount total status paymentMethod paymentStatus paymentRef expiresAt tickets paidAt createdAt updatedAt')
 .populate([{path:'showtime',select:'movie cinema room startTime',populate:{path:'movie',select:'title'}},{path:'foodItems.food',select:'name'}])
 .sort({ createdAt: -1, _id: -1 });

export async function simulationFailure(id) {
 if(process.env.NODE_ENV==='production'||process.env.ENABLE_PAYMENT_SIMULATION!=='true')throw fail('Giả lập chỉ được bật ở development.',403);
 const b=await Booking.findById(id);if(!b||b.status!=='pending'||b.expiresAt<=new Date())throw fail('Đơn không còn hiệu lực.',410);
 await PaymentAttempt.create({ref:crypto.randomUUID(),booking:b._id,amount:b.total,method:'demo',status:'failed',message:'User-selected simulated failure'});return loadBooking(id);
}
