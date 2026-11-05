import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import RevenueEntry from '../models/RevenueEntry.js';

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
    return 'verified';
  }
  // The existing pay() endpoint is a simulator; never promote it to real admission.
  if (demoEnabled() && (booking.ticketMode === 'demo' || booking.paymentMethod === 'mock' || /^PAY-\d+$/.test(booking.paymentRef || ''))) return 'demo';
  return null;
}

async function prepareIssue(booking, mode) {
  const showtime = await Showtime.findById(booking.showtime).populate('movie');
  if (!showtime?.movie || showtime.movie.classification === 'C' || !booking.seats.length ||
      new Set(booking.seats).size !== booking.seats.length) throw ticketError('Không thể phát hành vé cho đơn này.', 409);
  for (const number of booking.seats) {
    if (!showtime.seats.some((seat) => seat.number === number && String(seat.bookingId) === String(booking._id) &&
        (seat.status === 'booked' || (booking.status === 'pending' && seat.status === 'held')))) {
      throw ticketError('Ghế không còn thuộc đơn đặt vé này.', 409);
    }
  }
  const now = new Date();
  return {
    ticketMode: mode,
    ticketContext: { startTime: showtime.startTime, cinema: showtime.cinema, room: showtime.room,
      movieTitle: showtime.movie.title, classification: showtime.movie.classification || '', ageLimit: showtime.movie.ageLimit || 0 },
    tickets: booking.seats.map((seat) => ({ seat, reference: `${mode === 'demo' ? 'CTD' : 'CT'}-${randomBytes(16).toString('hex').toUpperCase()}`, status: 'issued', issuedAt: now }))
  };
}

export async function prepareDemoTickets(booking) {
  return demoEnabled() ? prepareIssue(booking, 'demo') : {};
}

export async function ownedTickets(bookingId, memberId) {
  if (!mongoose.isObjectIdOrHexString(bookingId)) throw ticketError('Mã đặt vé không hợp lệ.');
  let booking = await Booking.findOne({ _id: bookingId, user: memberId });
  if (!booking) throw ticketError('Không tìm thấy đơn đặt vé của bạn.', 404);
  const mode = await paymentMode(booking);
  if (!mode) return { bookingId: booking._id, bookingStatus: booking.status, tickets: [], message: 'Đơn chưa có thanh toán hợp lệ hoặc đã bị hủy/hoàn tiền; không có QR khả dụng.' };
  if (!booking.tickets.length) {
    const issue = await prepareIssue(booking, mode);
    // Legacy paid orders are issued once; parallel viewers reuse the same references.
    booking = await Booking.findOneAndUpdate({ _id: booking._id, user: memberId, status: 'paid', paymentStatus: 'paid', showtime: booking.showtime, seats: booking.seats,
      $or: [{ tickets: { $exists: false } }, { tickets: { $size: 0 } }] }, { $set: issue }, { new: true }) ||
      await Booking.findOne({ _id: bookingId, user: memberId });
  }
  if (!booking || booking.status !== 'paid' || booking.paymentStatus !== 'paid' || booking.ticketMode !== mode ||
      booking.tickets.length !== booking.seats.length || !booking.ticketContext?.startTime) {
    throw ticketError('Dữ liệu vé đã thay đổi hoặc chưa đồng bộ. Vui lòng tải lại.', 409);
  }
  const window = admissionWindow(booking.ticketContext);
  const tickets = [];
  for (const ticket of booking.tickets) {
    const status = ticket.status === 'issued' && new Date() > window.closesAt ? 'expired' : ticket.status;
    tickets.push({ reference: ticket.reference, seat: ticket.seat, status, checkedInAt: ticket.checkedInAt,
      qrDataUrl: status === 'issued' ? await QRCode.toDataURL(ticket.reference, { width: 264, margin: 4, errorCorrectionLevel: 'M' }) : null });
  }
  return { bookingId: booking._id, bookingStatus: booking.status, mode, showtime: booking.ticketContext, window, tickets };
}

function referenceValue(value) {
  if (typeof value !== 'string' || !/^CTD?-[A-F0-9]{32}$/.test(value.trim().toUpperCase())) throw ticketError('Mã vé không hợp lệ.');
  return value.trim().toUpperCase();
}

export async function checkInShowtimes() {
  const now = Date.now(), settings = admissionSettings();
  const showtimes = await Showtime.find({ startTime: { $gte: new Date(now - settings.closeAfterMinutes * 60000), $lte: new Date(now + 86400000) } })
    .select('movie cinema room startTime').populate({ path: 'movie', select: 'title' }).sort({ startTime: 1 }).limit(200);
  return { showtimes, settings };
}

async function inspectTicket(reference, showtimeId) {
  if (!mongoose.isObjectIdOrHexString(showtimeId)) throw ticketError('Vui lòng chọn suất chiếu đang soát vé.');
  const booking = await Booking.findOne({ 'tickets.reference': reference });
  if (!booking) throw ticketError('Không tìm thấy vé.', 404);
  const ticket = booking.tickets.find((item) => item.reference === reference);
  const context = booking.ticketContext;
  if (!context?.startTime) throw ticketError('Vé chưa có thông tin suất chiếu hợp lệ.', 409);
  const window = admissionWindow(context), now = new Date();
  const requiresAgeCheck = ['K', 'T13', 'T16', 'T18'].includes(context.classification) || Number(context.ageLimit) > 0;
  let reason = '';
  const mode = await paymentMode(booking);
  if (!mode || mode !== booking.ticketMode) reason = 'Đơn chưa thanh toán hợp lệ, đã hủy hoặc đang/đã hoàn tiền.';
  else if (String(booking.showtime) !== String(showtimeId)) reason = 'Vé không thuộc suất chiếu đang soát.';
  else if (ticket.status !== 'issued') reason = ticket.status === 'checked-in' ? 'Vé đã được check-in; không được sử dụng lại.' : 'Vé không còn sử dụng được.';
  else if (now < window.opensAt) reason = 'Chưa đến giờ nhận khách cho suất chiếu này.';
  else if (now > window.closesAt) reason = 'Đã hết giờ nhận khách cho suất chiếu này.';
  else {
    const showtime = await Showtime.findById(booking.showtime);
    if (!showtime || showtime.startTime.getTime() !== context.startTime.getTime() ||
        !showtime.seats.some((seat) => seat.number === ticket.seat && seat.status === 'booked' && String(seat.bookingId) === String(booking._id))) {
      reason = 'Suất chiếu hoặc quyền sở hữu ghế đã thay đổi; cần kiểm tra lại.';
    }
  }
  return { booking, ticket, data: { reference, seat: ticket.seat, status: ticket.status, checkedInAt: ticket.checkedInAt,
    mode: booking.ticketMode, showtime: context, window, requiresAgeCheck, eligible: !reason, reason } };
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
  const settings = admissionSettings();
  let saved;
  try {
    saved = await Booking.findOneAndUpdate({ _id: booking._id, status: 'paid', paymentStatus: 'paid', ticketMode: booking.ticketMode,
      showtime: booking.showtime,
      $and: [
        { 'ticketContext.startTime': booking.ticketContext.startTime },
        { 'ticketContext.startTime': { $gte: new Date(now.getTime() - settings.closeAfterMinutes * 60000), $lte: new Date(now.getTime() + settings.openBeforeMinutes * 60000) } }
      ],
      tickets: { $elemMatch: { reference, status: 'issued' } }
    }, { $set: { 'tickets.$.status': 'checked-in', 'tickets.$.checkedInAt': now, 'tickets.$.checkedInBy': employeeId } }, { new: true });
  } catch {
    throw ticketError('Chưa xác nhận lưu check-in. Không cho vào rạp; hãy tra cứu lại trạng thái trước khi xử lý tiếp.', 503);
  }
  if (!saved) throw ticketError('Vé vừa được sử dụng, đơn đã thay đổi hoặc hết giờ nhận khách. Hãy tra cứu lại.', 409);
  console.info('[TICKET CHECK-IN]', JSON.stringify({ bookingId: booking._id, ticketId: ticket._id, employeeId, mode: booking.ticketMode, checkedInAt: now }));
  return { ...data, status: 'checked-in', checkedInAt: now, eligible: false,
    admissionGranted: booking.ticketMode === 'verified',
    message: booking.ticketMode === 'demo' ? 'Check-in mô phỏng đã lưu. Đây không phải xác nhận vào rạp.' : 'Check-in thành công. Có thể cho khách vào rạp.' };
}
