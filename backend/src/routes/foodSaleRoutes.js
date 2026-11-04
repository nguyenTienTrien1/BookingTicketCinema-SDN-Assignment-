import { Router } from 'express';
import { verifyToken } from '../middleware/auth/verifyToken.js';
import { requireRole } from '../middleware/auth/requireRole.js';
import * as controller from '../controllers/foodSaleController.js';

const router = Router();
router.use(verifyToken, requireRole('employee'));
router.get('/catalogue', controller.catalogue);
router.post('/', controller.create);
router.get('/:id', controller.detail);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/pay', controller.pay);
export default router;
