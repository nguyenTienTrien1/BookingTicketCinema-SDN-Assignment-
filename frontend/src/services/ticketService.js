import { api } from './api';
export const getBookingTickets = (id, signal) => api(`/bookings/${encodeURIComponent(id)}/tickets`, { signal });
export const getCheckInShowtimes = (signal) => api('/tickets/showtimes', { signal });
export const lookupTicket = (reference, showtimeId, signal) => api(`/tickets/lookup?reference=${encodeURIComponent(reference)}&showtimeId=${encodeURIComponent(showtimeId)}`, { signal });
export const checkInTicket = (reference, data) => api(`/tickets/${encodeURIComponent(reference)}/check-in`, { method: 'POST', body: JSON.stringify(data) });
