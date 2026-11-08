import * as s from "../../services/movies/movieService.js";
export async function movies(req,res,next){try{res.json(await s.listMovies());}catch(e){next(e);}}
export async function showtimes(req,res,next){try{res.json(await s.listShowtimes(req.query.movie));}catch(e){next(e);}}

export async function adminMovies(req, res, next) {
  try {
    res.json(await s.listAdminMovies(req.query));
  } catch (error) {
    next(error);
  }
}

export async function addMovie(req, res, next) {
  try {
    const movie = await s.createMovie(req.body, req.user._id);
    res.status(201).json({ message: 'Thêm phim thành công.', movie });
  } catch (error) {
    next(error);
  }
}

export async function movieDetail(req, res, next) {
  try { res.json(await s.getAdminMovie(req.params.id)); } catch (error) { next(error); }
}

export async function updateMovie(req, res, next) {
  try {
    res.json({ message: 'Cập nhật phim thành công.', movie: await s.updateMovie(req.params.id, req.body, req.user._id) });
  } catch (error) { next(error); }
}

export async function deleteMovie(req, res, next) {
  try {
    await s.deleteMovie(req.params.id, req.body, req.user._id);
    res.json({ message: 'Xóa phim thành công.' });
  } catch (error) { next(error); }
}
