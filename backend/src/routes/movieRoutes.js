import {Router} from 'express';import * as c from '../controllers/movieController.js';const r=Router();r.get('/',c.movies);r.get('/showtimes',c.showtimes);export default r;
