import * as s from '../services/movieService.js';
export async function movies(req,res,next){try{res.json(await s.listMovies());}catch(e){next(e);}}
export async function showtimes(req,res,next){try{res.json(await s.listShowtimes(req.query.movie));}catch(e){next(e);}}
