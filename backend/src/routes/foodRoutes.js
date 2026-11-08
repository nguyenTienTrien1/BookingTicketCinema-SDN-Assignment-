import { Router } from 'express';
import Food from '../models/Food.js';
import { verifyToken } from '../middleware/auth/verifyToken.js';
import { requireRole } from '../middleware/auth/requireRole.js';
import * as controller from '../controllers/catalogueController.js';
import { protectImageUpload, readImage, uploadImage } from '../controllers/foodImageController.js';

const router = Router();
router.get('/', async (_req, res, next) => {
  try { res.json(await Food.find({ available: true, deletedAt: null }).select('-createdBy -updatedBy -deletedBy -nameKey')); }
  catch (error) { next(error); }
});
router.use(verifyToken, requireRole('admin'));
router.post('/images', protectImageUpload, readImage, uploadImage);
router.get('/admin', controller.foods);
router.get('/admin/:id', controller.food);
router.post('/', controller.protectWrite, controller.createFood);
router.put('/:id', controller.protectWrite, controller.updateFood);
router.delete('/:id', controller.protectWrite, controller.deleteFood);
export default router;
