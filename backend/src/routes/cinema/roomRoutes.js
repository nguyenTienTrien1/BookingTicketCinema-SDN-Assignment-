import { Router } from 'express';
import * as controller from "../../controllers/cinema/roomController.js";
import { verifyToken } from "../../middleware/auth/verifyToken.js";
import { requireRole } from "../../middleware/auth/requireRole.js";
import { protectWrite } from "../../controllers/cinema/showtimeController.js";

const router = Router();
router.use(verifyToken, requireRole('admin'));
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/', controller.list);
router.get('/:id/seats', controller.detail);
router.post('/:id/seats/preview', protectWrite, controller.preview);
router.put('/:id/seats', protectWrite, controller.seats);
router.get('/:id', controller.detail);
router.post('/', protectWrite, controller.create);
router.put('/:id', protectWrite, controller.update);
router.delete('/:id', protectWrite, controller.remove);
export default router;
