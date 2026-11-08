import { Router } from 'express';
import { verifyToken } from "../../middleware/auth/verifyToken.js";
import { requireRole } from "../../middleware/auth/requireRole.js";
import * as counter from "../../controllers/bookings/counterController.js";
import { protectWrite } from "../../controllers/cinema/showtimeController.js";

const router = Router();
router.use(verifyToken, requireRole('admin', 'employee'));
router.get('/members', counter.searchMembers);
router.post('/bookings', counter.create);
router.patch('/bookings/:id/points', counter.points);
router.patch('/bookings/:id/promotion', protectWrite, counter.promotion);
router.post('/bookings/:id/pay', protectWrite, counter.payment);
router.patch('/bookings/:id/food',counter.food);router.post('/bookings/:id/cancel',counter.cancel);
export default router;
