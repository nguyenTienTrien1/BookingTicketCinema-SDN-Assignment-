import { Router } from 'express';
import { verifyToken } from '../middleware/auth/verifyToken.js';
import { requireRole } from '../middleware/auth/requireRole.js';
import * as counter from '../controllers/counterController.js';

const router = Router();
router.use(verifyToken, requireRole('admin', 'employee'));
router.get('/members', counter.searchMembers);
router.post('/bookings', counter.create);
router.patch('/bookings/:id/points', counter.points);
router.post('/bookings/:id/pay', counter.payment);
router.patch('/bookings/:id/food',counter.food);router.post('/bookings/:id/cancel',counter.cancel);
export default router;
