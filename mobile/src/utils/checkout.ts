import type { Booking } from './types';

export function holdSeconds(booking: Pick<Booking, 'expiresAt' | 'showtime'>, now: number) {
  const expiry = new Date(booking.expiresAt).getTime();
  const start = booking.showtime?.startTime ? new Date(booking.showtime.startTime).getTime() : expiry;
  const deadline = Math.min(expiry, start);
  return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}

export function maxRedeemablePoints(balance: number, amount: number, step: number) {
  if (!Number.isSafeInteger(step) || step < 1 || !Number.isFinite(balance) || !Number.isFinite(amount)) return 0;
  return Math.max(0, Math.floor(Math.min(balance, amount / 1000) / step) * step);
}

export function validRedemption(value: string, maximum: number, step: number) {
  const points = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(points) && points <= maximum && points % step === 0;
}

export function bookingSummary(booking: Pick<Booking, 'showtime' | 'ticketContext'>) {
  return {
    title: booking.showtime?.movie?.title || booking.ticketContext?.movieTitle || 'Đơn vé',
    cinema: booking.showtime?.cinema || booking.ticketContext?.cinema || '',
    room: booking.showtime?.room || booking.ticketContext?.room || '',
    startTime: booking.showtime?.startTime || booking.ticketContext?.startTime || '',
  };
}
