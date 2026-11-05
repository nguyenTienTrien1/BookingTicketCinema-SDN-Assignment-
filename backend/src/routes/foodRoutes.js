import { Router } from 'express';
import Food from '../models/Food.js';
import { verifyToken } from '../middleware/auth/verifyToken.js';
import { requireRole } from '../middleware/auth/requireRole.js';
import * as controller from '../controllers/catalogueController.js';

const router = Router();
router.get('/', async (_req, res, next) => {
  try { res.json(await Food.find({ available: true, deletedAt: null }).select('-createdBy -updatedBy -deletedBy -nameKey')); }
  catch (error) { next(error); }
});
router.use(verifyToken, requireRole('admin'));
router.get('/admin', controller.foods);
router.get('/admin/:id', controller.food);
router.post('/', controller.protectWrite, controller.createFood);
export default router;
