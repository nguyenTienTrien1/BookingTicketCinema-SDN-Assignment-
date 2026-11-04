import {api} from './api';
export const getMovies=()=>api('/movies');
export const getShowtimes=()=>api('/movies/showtimes');

export function getAdminMovies(search = '', page = 1) {
  const params = new URLSearchParams({ search, page: String(page), limit: '10' });
  return api(`/movies/admin?${params}`, { credentials: 'include' });
}

export function addMovie(movie) {
  return api('/movies', {
    method: 'POST', credentials: 'include', body: JSON.stringify(movie)
  });
}

export function getAdminMovie(id) {
  return api(`/movies/admin/${id}`);
}

export function updateMovie(id, movie) {
  return api(`/movies/${id}`, { method: 'PUT', body: JSON.stringify(movie) });
}
