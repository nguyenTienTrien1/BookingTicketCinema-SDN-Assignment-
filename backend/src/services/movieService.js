import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
export const listMovies=()=>Movie.find().sort({featured:-1,createdAt:-1});
export const listShowtimes=(movieId)=>Showtime.find(movieId?{movie:movieId}:{}).populate('movie').sort({startTime:1});
export const getMovie=id=>Movie.findById(id);
