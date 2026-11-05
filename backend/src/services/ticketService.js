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
