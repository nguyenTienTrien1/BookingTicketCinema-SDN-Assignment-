import { Router } from 'express';
import { verifyToken } from "../../middleware/auth/verifyToken.js";
import { requireRole } from "../../middleware/auth/requireRole.js";
import * as controller from "../../controllers/catalogue/foodSaleController.js";
import { protectWrite } from '../../controllers/bookings/ticketController.js';

const router = Router();
router.get('/vnpay/return', controller.returnUrl);
router.use(verifyToken, requireRole('employee'));
router.get('/catalogue', controller.catalogue);
router.post('/', controller.create);
router.get('/:id', controller.detail);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/pay', controller.pay);
router.patch('/:id/promotion', protectWrite, controller.promotion);
router.post('/:id/vnpay', protectWrite, controller.vnpay);
export default router;
