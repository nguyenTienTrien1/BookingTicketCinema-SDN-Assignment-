import { Router } from 'express';
import { verifyToken } from "../../middleware/auth/verifyToken.js";
import { requireRole } from "../../middleware/auth/requireRole.js";
import * as controller from "../../controllers/catalogue/catalogueController.js";

const router = Router();
router.get('/', controller.availablePromotions);
router.use(verifyToken, requireRole('admin'));
router.get('/admin', controller.promotions);
router.get('/admin/:id', controller.promotion);
router.post('/', controller.protectWrite, controller.createPromotion);
router.put('/:id', controller.protectWrite, controller.updatePromotion);
router.delete('/:id', controller.protectWrite, controller.deletePromotion);
export default router;
