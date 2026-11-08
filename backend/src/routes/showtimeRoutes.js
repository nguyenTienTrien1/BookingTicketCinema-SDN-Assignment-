import { Router } from 'express';
import * as controller from '../controllers/showtimeController.js';
import { verifyToken } from '../middleware/auth/verifyToken.js';
import { requireRole } from '../middleware/auth/requireRole.js';
import { cancelShowtime } from '../controllers/refundController.js';

const router = Router();
router.use(verifyToken, requireRole('admin'));
router.get('/rooms', controller.rooms);
router.post('/suggestions', controller.protectWrite, controller.suggest);
router.post('/suggestions/confirm', controller.protectWrite, controller.confirm);
router.post('/:id/cancel', controller.protectWrite, cancelShowtime);
router.get('/:id', controller.detail);
router.get('/', controller.viewShowtimes);
router.post('/', controller.protectWrite, controller.addShowtime);
router.put('/:id', controller.protectWrite, controller.updateShowtime);
router.delete('/:id', controller.protectWrite, controller.deleteShowtime);
export default router;
