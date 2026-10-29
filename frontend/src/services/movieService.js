import {api} from './api';
export const getMovies=()=>api('/movies');
export const getShowtimes=()=>api('/movies/showtimes');

export function getAdminMovies(search = '', page = 1) {
  const params = new URLSearchParams({ search, page: String(page), limit: '10' });
  return api(`/movies/admin?${params}`, { credentials: 'include' });
}
