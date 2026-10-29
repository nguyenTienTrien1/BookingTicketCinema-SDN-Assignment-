import { Router } from 'express';
import * as c from '../controllers/movieController.js';
import { verifyToken } from '../middleware/auth/verifyToken.js';
import { requireRole } from '../middleware/auth/requireRole.js';

const r = Router();
r.get('/', c.movies);
r.get('/showtimes', c.showtimes);
r.get('/admin', verifyToken, requireRole('admin'), c.adminMovies);
export default r;
