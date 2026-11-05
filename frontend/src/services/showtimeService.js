import { api } from './api';

export function getAdminShowtimes(movie = '', page = 1) {
  const params = new URLSearchParams({ movie, page: String(page), limit: '10' });
  return api(`/showtimes?${params}`, { credentials: 'include' });
}

export function addShowtime(data) {
  return api('/showtimes', { method: 'POST', credentials: 'include', body: JSON.stringify(data) });
}

