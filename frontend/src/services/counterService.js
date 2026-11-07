import { api } from './api';

export const searchMembers = (search, signal) => api(`/counter/members?search=${encodeURIComponent(search)}`, { signal });
export const createCounterBooking = (data) => api('/counter/bookings', { method: 'POST', body: JSON.stringify(data) });
export const applyCounterPoints = (id, data) => api(`/counter/bookings/${id}/points`, { method: 'PATCH', body: JSON.stringify(data) });
export const payCounterBooking = (id, data) => api(`/counter/bookings/${id}/pay`, { method: 'POST', body: JSON.stringify(data) });
