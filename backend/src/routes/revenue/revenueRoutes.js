import { Router } from 'express';
import { verifyToken } from "../../middleware/auth/verifyToken.js";
import { requireRole } from "../../middleware/auth/requireRole.js";
import * as revenue from "../../controllers/revenue/revenueController.js";

const router = Router();
router.use(verifyToken, requireRole('admin'), revenue.protectReportRequest);
router.post('/reports', revenue.dashboard);
router.post('/reports/:id/export', revenue.download);
export default router;
