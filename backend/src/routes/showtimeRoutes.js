import { Router } from 'express';
import * as controller from '../controllers/showtimeController.js';
import { verifyToken } from '../middleware/auth/verifyToken.js';
import { requireRole } from '../middleware/auth/requireRole.js';

const router = Router();
router.use(verifyToken, requireRole('admin'));
router.get('/', controller.list);
router.post('/', controller.protectWrite, controller.create);
router.put('/:id', controller.protectWrite, controller.update);
router.delete('/:id', controller.protectWrite, controller.remove);
export default router;
