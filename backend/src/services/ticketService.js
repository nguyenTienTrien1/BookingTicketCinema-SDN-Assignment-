import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import RevenueEntry from '../models/RevenueEntry.js';
import PaymentAttempt from '../models/PaymentAttempt.js';

function ticketError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function admissionSettings() {
  const openBeforeMinutes = Number(process.env.CHECKIN_OPEN_MINUTES ?? 30);
  const closeAfterMinutes = Number(process.env.CHECKIN_CLOSE_MINUTES ?? 15);
  if (![openBeforeMinutes, closeAfterMinutes].every((value) => Number.isInteger(value) && value >= 0 && value <= 180)) {
    throw ticketError('Cấu hình giờ vào rạp không hợp lệ.', 503);
  }
  return { openBeforeMinutes, closeAfterMinutes };
}

function admissionWindow(context) {
  const settings = admissionSettings();
  const start = new Date(context.startTime).getTime();
  return { ...settings, opensAt: new Date(start - settings.openBeforeMinutes * 60000), closesAt: new Date(start + settings.closeAfterMinutes * 60000) };
}

function demoEnabled() { return process.env.NODE_ENV !== 'production'; }

async function paymentMode(booking) {
  if (booking.status !== 'paid' || booking.paymentStatus !== 'paid') return null;
  if (await RevenueEntry.exists({ booking: booking._id, kind: 'refund' })) return null;
  const entry = await RevenueEntry.findOne({ booking: booking._id, kind: 'payment' }).lean();
  if (entry) {
    const expectedEvidence = entry.method === 'cash' ? 'employee-receipt' : entry.method === 'points' ? 'points-ledger' : 'provider-confirmation';
    const amounts = [entry.gross, entry.discounts, entry.fees, entry.points, entry.amount];
    const deadline = new Date(booking.expiresAt || 0).getTime();
    if (entry.reference !== booking.paymentRef || entry.currency !== 'VND' || entry.evidence !== expectedEvidence ||
        !['cash', 'vnpay', 'momo', 'credit-card', 'points'].includes(entry.method) ||
        entry.method !== booking.paymentMethod || !amounts.every((value) => Number.isSafeInteger(value) && value >= 0) ||
        entry.gross - entry.discounts + entry.fees - entry.points !== entry.amount || entry.amount !== booking.total ||
        entry.confirmedAt > new Date() || entry.confirmedAt.getTime() > deadline) return null;
    const attempt = await PaymentAttempt.findOne({ booking: booking._id, ref: entry.reference }).lean();
    if (attempt && (attempt.status !== 'succeeded' || attempt.currency !== 'VND' || attempt.method !== entry.method || attempt.amount !== entry.amount)) return null;
    return 'verified';
  }
  // The transactional payment flow records trusted settlement in PaymentAttempt.
  const attempt = await PaymentAttempt.findOne({ booking: booking._id, ref: booking.paymentRef,
    status: 'succeeded', currency: 'VND', method: booking.paymentMethod }).lean();
  if (attempt) {
    if (!Number.isSafeInteger(attempt.amount) || attempt.amount < 0 || attempt.amount !== booking.total ||
        !booking.paidAt || booking.paidAt > new Date() || booking.paidAt > booking.expiresAt) return null;
    if (attempt.method === 'demo') return demoEnabled() && process.env.ENABLE_PAYMENT_SIMULATION === 'true' ? 'demo' : null;
    if (attempt.method === 'cash' && attempt.actor && attempt.receivedAmount === booking.total && booking.total > 0) return 'verified';
    if (attempt.method === 'vnpay' && attempt.providerRef) return 'verified';
    if (attempt.method === 'points' && booking.total === 0) return 'verified';
    return null;
  }
  // Retain explicitly marked legacy demo orders without promoting them to real admission.
  if (booking.paymentMethod === 'demo') return null;
  if (demoEnabled() && (booking.ticketMode === 'demo' || booking.paymentMethod === 'mock' || /^PAY-\d+$/.test(booking.paymentRef || ''))) return 'demo';
  return null;
}

async function issueContext(booking) {
  const showtime = await Showtime.findById(booking.showtime).populate('movie');
  if (!showtime?.movie || showtime.cancelledAt || showtime.movie.classification === 'C' || !booking.seats.length ||
      new Set(booking.seats).size !== booking.seats.length) throw ticketError('Không thể phát hành vé cho đơn này.', 409);
  for (const number of booking.seats) {
    if (!showtime.seats.some((seat) => seat.number === number && String(seat.bookingId) === String(booking._id) &&
        (seat.status === 'booked' || (booking.status === 'pending' && seat.status === 'held')))) {
      throw ticketError('Ghế không còn thuộc đơn đặt vé này.', 409);
    }
  }
  return { startTime: showtime.startTime, cinema: showtime.cinema, room: showtime.room,
    movieTitle: showtime.movie.title, classification: showtime.movie.classification || '', ageLimit: showtime.movie.ageLimit || 0 };
}

async function prepareIssue(booking, mode) {
  const context = await issueContext(booking), now = new Date();
  return {
    ticketMode: mode,
    ticketContext: context,
    tickets: booking.seats.map((seat) => ({ seat, reference: `${mode === 'demo' ? 'CTD' : 'CT'}-${randomBytes(16).toString('hex').toUpperCase()}`, status: 'issued', issuedAt: now }))
  };
}

export async function prepareDemoTickets(booking) {
  return demoEnabled() ? prepareIssue(booking, 'demo') : {};
}

function ticketStatus(ticket) { return ticket.status === 'valid' ? 'issued' : ticket.status; }

export async function ownedTickets(bookingId, memberId) {
  if (!mongoose.isObjectIdOrHexString(bookingId)) throw ticketError('Mã đặt vé không hợp lệ.');
  const booking = await Booking.findOne({ _id: bookingId, user: memberId });
  if (!booking) throw ticketError('Không tìm thấy đơn đặt vé của bạn.', 404);
  const result = { bookingId: booking._id, bookingStatus: booking.status, tickets: [] };
  const mode = await paymentMode(booking);
  if (!mode) {
    const messages = {
      pending: 'Đơn chưa hoàn tất thanh toán; chưa có vé QR khả dụng.',
      cancelled: 'Đơn đã hủy; vé không còn sử dụng được.',
      'refund-requested': 'Đơn đang yêu cầu hoàn tiền; vé tạm thời không sử dụng được.',
      refunded: 'Đơn đã hoàn tiền; vé không còn sử dụng được.'
    };
    if (booking.status === 'paid' && await RevenueEntry.exists({ booking: booking._id, kind: 'refund' })) result.bookingStatus = 'refunded';
    return { ...result, message: messages[result.bookingStatus] || 'Chưa xác minh được thanh toán của đơn; không có QR khả dụng. Vui lòng liên hệ nhân viên.' };
  }
  if (!booking.tickets.length) {
    return { ...result, mode, message: 'Đơn đã ghi nhận thanh toán nhưng chưa có vé được phát hành. Vui lòng liên hệ nhân viên.' };
  }
  const references = booking.tickets.map(ticket => ticket.reference || ticket.code);
  const seats = booking.tickets.map(ticket => ticket.seat);
  if ((booking.ticketMode && booking.ticketMode !== mode) || booking.tickets.length !== booking.seats.length ||
      references.some(reference => !reference) || new Set(references).size !== references.length ||
      new Set(seats).size !== seats.length || seats.some(seat => !booking.seats.includes(seat))) {
    throw ticketError('Dữ liệu vé chưa đồng bộ. Vui lòng liên hệ nhân viên.', 409);
  }
  // Older issued tickets may lack metadata. Derive the response without writing.
  const context = booking.ticketContext?.startTime ? booking.ticketContext : await issueContext(booking);
  const window = admissionWindow(context);
  const tickets = [];
  for (const ticket of booking.tickets) {
    const reference = ticket.reference || ticket.code;
    const currentStatus = ticketStatus(ticket);
    const status = currentStatus === 'issued' && new Date() > window.closesAt ? 'expired' : currentStatus;
    tickets.push({ reference, seat: ticket.seat, status, checkedInAt: ticket.checkedInAt,
      qrDataUrl: status === 'issued' ? ticket.qr || await QRCode.toDataURL(reference, { width: 264, margin: 4, errorCorrectionLevel: 'M' }) : null });
  }
  return { ...result, mode, showtime: context, window, tickets };
}

function referenceValue(value) {
  if (typeof value !== 'string' || value.length > 512) throw ticketError('Mã vé không hợp lệ.');
  value = value.trim();
  if (value.startsWith('{')) {
    try { value = JSON.parse(value).ticket; } catch { throw ticketError('Mã vé không hợp lệ.'); }
  }
  if (typeof value !== 'string') throw ticketError('Mã vé không hợp lệ.');
  if (/^[a-f0-9]{48}$/i.test(value)) return value.toLowerCase();
  if (!/^CTD?-[A-F0-9]{32}$/.test(value.toUpperCase())) throw ticketError('Mã vé không hợp lệ.');
  return value.trim().toUpperCase();
}

export async function checkInShowtimes() {
  const now = Date.now(), settings = admissionSettings();
  const showtimes = await Showtime.find({ cancelledAt: null, startTime: { $gte: new Date(now - settings.closeAfterMinutes * 60000), $lte: new Date(now + 86400000) } })
    .select('movie cinema room startTime').populate({ path: 'movie', select: 'title' }).sort({ startTime: 1 }).limit(200);
  return { showtimes, settings };
}

async function inspectTicket(reference, showtimeId) {
  if (!mongoose.isObjectIdOrHexString(showtimeId)) throw ticketError('Vui lòng chọn suất chiếu đang soát vé.');
  const booking = await Booking.findOne({ $or: [{ 'tickets.reference': reference }, { 'tickets.code': reference }] });
  if (!booking) throw ticketError('Không tìm thấy vé.', 404);
  const mode = await paymentMode(booking);
  const matches = booking.tickets.filter(item => (item.reference || item.code) === reference);
  if (matches.length !== 1 || !booking.seats.includes(matches[0].seat)) throw ticketError('Dữ liệu vé chưa đồng bộ. Vui lòng liên hệ quản lý.', 409);
  const ticket = matches[0];
  const context = booking.ticketContext?.startTime ? booking.ticketContext : await issueContext(booking);
  const window = admissionWindow(context), now = new Date();
  const requiresAgeCheck = ['K', 'T13', 'T16', 'T18'].includes(context.classification) || Number(context.ageLimit) > 0;
  let reason = '';
  if (!mode || (booking.ticketMode && mode !== booking.ticketMode)) reason = 'Đơn chưa thanh toán hợp lệ, đã hủy hoặc đang/đã hoàn tiền.';
  else if (String(booking.showtime) !== String(showtimeId)) reason = 'Vé không thuộc suất chiếu đang soát.';
  else if (ticketStatus(ticket) !== 'issued') reason = ticket.status === 'checked-in' ? 'Vé đã được check-in; không được sử dụng lại.' : 'Vé không còn sử dụng được.';
  else if (now < window.opensAt) reason = 'Chưa đến giờ nhận khách cho suất chiếu này.';
  else if (now > window.closesAt) reason = 'Đã hết giờ nhận khách cho suất chiếu này.';
  else {
    const showtime = await Showtime.findById(booking.showtime);
    if (!showtime || showtime.startTime.getTime() !== context.startTime.getTime() || showtime.cinema !== context.cinema || showtime.room !== context.room ||
        !showtime.seats.some((seat) => seat.number === ticket.seat && seat.status === 'booked' && String(seat.bookingId) === String(booking._id))) {
      reason = 'Suất chiếu hoặc quyền sở hữu ghế đã thay đổi; cần kiểm tra lại.';
    }
  }
  return { booking, ticket, data: { reference, seat: ticket.seat, status: ticketStatus(ticket), checkedInAt: ticket.checkedInAt,
    mode: mode || booking.ticketMode, showtime: context, window, requiresAgeCheck, eligible: !reason, reason } };
}

export async function lookupTicket(reference, showtimeId) {
  return (await inspectTicket(referenceValue(reference), showtimeId)).data;
}

export async function checkInTicket(reference, body, employeeId) {
  reference = referenceValue(reference);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw ticketError('Dữ liệu check-in không hợp lệ.');
  const { booking, ticket, data } = await inspectTicket(reference, body.showtimeId);
  if (!data.eligible) throw ticketError(data.reason, 409);
  if (data.requiresAgeCheck && body.ageVerified !== true) throw ticketError('Cần xác nhận đã kiểm tra độ tuổi/điều kiện người giám hộ.');
  const now = new Date();
  const fields = { 'tickets.$.status': 'checked-in', 'tickets.$.checkedInAt': now, 'tickets.$.checkedInBy': employeeId };
  // Legacy metadata is saved only with a successful check-in, never by lookup.
  if (!booking.ticketMode) fields.ticketMode = data.mode;
  if (!booking.ticketContext?.startTime) fields.ticketContext = data.showtime;
  if (!ticket.reference) fields['tickets.$.reference'] = reference;
  if (!ticket.issuedAt) fields['tickets.$.issuedAt'] = booking.paidAt || booking.createdAt;
  let saved;
  try {
    saved = await Booking.findOneAndUpdate({ _id: booking._id, status: 'paid', paymentStatus: 'paid', ticketMode: booking.ticketMode || { $exists: false },
      showtime: booking.showtime, seats: ticket.seat, paymentRef: booking.paymentRef, paymentMethod: booking.paymentMethod, total: booking.total,
      'ticketContext.startTime': booking.ticketContext?.startTime || { $exists: false },
      'ticketContext.classification': booking.ticketContext?.classification ?? { $exists: false },
      'ticketContext.ageLimit': booking.ticketContext?.ageLimit ?? { $exists: false },
      'ticketContext.cinema': booking.ticketContext?.cinema ?? { $exists: false },
      'ticketContext.room': booking.ticketContext?.room ?? { $exists: false },
      $expr: { $and: [{ $gte: ['$$NOW', data.window.opensAt] }, { $lte: ['$$NOW', data.window.closesAt] }] },
      tickets: { $elemMatch: { _id: ticket._id, seat: ticket.seat, status: { $in: ['issued','valid'] },
        $or: [{ reference }, { reference: { $in: [null, ''] }, code: reference }] } }
    }, { $set: fields }, { new: true });
  } catch {
    throw ticketError('Chưa xác nhận lưu check-in. Không cho vào rạp; hãy tra cứu lại trạng thái trước khi xử lý tiếp.', 503);
  }
  if (!saved) throw ticketError('Vé vừa được sử dụng, đơn đã thay đổi hoặc hết giờ nhận khách. Hãy tra cứu lại.', 409);
  console.info('[TICKET CHECK-IN]', JSON.stringify({ bookingId: booking._id, ticketId: ticket._id, employeeId, mode: data.mode, checkedInAt: now }));
  return { ...data, status: 'checked-in', checkedInAt: now, eligible: false,
    admissionGranted: data.mode === 'verified',
    message: data.mode === 'demo' ? 'Check-in mô phỏng đã lưu. Đây không phải xác nhận vào rạp.' : 'Check-in thành công. Có thể cho khách vào rạp.' };
}
