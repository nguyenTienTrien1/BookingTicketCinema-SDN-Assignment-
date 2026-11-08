import {api, API} from './api';
export async function uploadMovieImage(file) {
  const result = await api('/movies/images', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
  return result.image;
}
export function movieImageUrl(image) {
  return image?.startsWith('/api/uploads/movies/') ? new URL(image, new URL(API, window.location.origin)).href : image;
}
const resolveMovieImages = movie => ({ ...movie, poster: movieImageUrl(movie.poster), banner: movieImageUrl(movie.banner) });
export const getMovies=async()=>(await api('/movies')).map(resolveMovieImages);
export const getShowtimes=async()=>(await api('/movies/showtimes')).map(show => ({ ...show, movie: show.movie && typeof show.movie === 'object' ? resolveMovieImages(show.movie) : show.movie }));

export function getAdminMovies(search = '', page = 1, classification = '') {
  const params = new URLSearchParams({ search, page: String(page), limit: '10' });
  if (classification) params.set('classification', classification);
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

export function deleteMovie(id, version) {
  return api(`/movies/${id}`, { method: 'DELETE', body: JSON.stringify({ version }) });
}
