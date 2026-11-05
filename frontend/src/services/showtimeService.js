import { api } from './api';

export function getAdminShowtimes(movie = '', page = 1) {
  const params = new URLSearchParams({ movie, page: String(page), limit: '10' });
  return api(`/showtimes?${params}`, { credentials: 'include' });
}

export function addShowtime(data) {
  return api('/showtimes', { method: 'POST', credentials: 'include', body: JSON.stringify(data) });
}

export function updateShowtime(id, data) {
  return api(`/showtimes/${id}`, { method: 'PUT', credentials: 'include', body: JSON.stringify(data) });
}

export function deleteShowtime(id, updatedAt) {
  return api(`/showtimes/${id}`, {
    method: 'DELETE', credentials: 'include', body: JSON.stringify({ updatedAt })
  });
}
