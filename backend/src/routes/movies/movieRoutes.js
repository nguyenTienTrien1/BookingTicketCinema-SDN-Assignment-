import { Router } from 'express';
import * as c from "../../controllers/movies/movieController.js";
import { verifyToken } from "../../middleware/auth/verifyToken.js";
import { requireRole } from "../../middleware/auth/requireRole.js";

const r = Router();
r.get('/', c.movies);
r.get('/showtimes', c.showtimes);
r.get('/admin', verifyToken, requireRole('admin'), c.adminMovies);
r.post('/', verifyToken, requireRole('admin'), c.addMovie);
r.get('/admin/:id', verifyToken, requireRole('admin'), c.movieDetail);
r.put('/:id', verifyToken, requireRole('admin'), c.updateMovie);
r.delete('/:id', verifyToken, requireRole('admin'), c.deleteMovie);
export default r;
