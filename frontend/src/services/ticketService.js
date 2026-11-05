import { api } from './api';
export const getBookingTickets = (id, signal) => api(`/bookings/${encodeURIComponent(id)}/tickets`, { signal });
