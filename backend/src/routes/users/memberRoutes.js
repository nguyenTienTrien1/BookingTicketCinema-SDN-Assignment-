import { Router } from 'express';
import { verifyToken } from "../../middleware/auth/verifyToken.js";
import { requireRole } from "../../middleware/auth/requireRole.js";
import * as controller from "../../controllers/users/memberController.js";

const router = Router();
router.use(verifyToken, requireRole('employee', 'admin'));
router.get('/search', controller.search);
router.get('/:id', controller.detail);
export default router;
