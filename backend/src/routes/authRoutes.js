import {Router} from 'express';import {login} from '../controllers/authController.js';const r=Router();r.post('/login',login);export default r;
