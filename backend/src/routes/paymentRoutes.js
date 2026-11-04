import {Router} from 'express';
import {verifyToken} from '../middleware/auth/verifyToken.js';
import {requireRole} from '../middleware/auth/requireRole.js';
import * as p from '../controllers/paymentController.js';
const r=Router();r.get('/vnpay/ipn',p.ipn);r.get('/vnpay/return',p.returnUrl);
r.use(verifyToken,requireRole('admin','employee'));
r.get('/tickets/:code',p.ticket);r.get('/bookings/:id',p.lookup);r.post('/bookings/:id/cash',p.cash);r.patch('/members/:id/age',p.verifyAge);r.get('/reconciliation',requireRole('admin'),p.reconciliation);r.get('/stock',requireRole('admin'),p.stock);r.patch('/stock/:id',requireRole('admin'),p.stock);
export default r;
