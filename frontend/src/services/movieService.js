import {api} from './api';
export const getMovies=()=>api('/movies');
export const getShowtimes=()=>api('/movies/showtimes');
