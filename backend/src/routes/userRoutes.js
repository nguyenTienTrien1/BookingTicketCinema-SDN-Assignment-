import { Router } from 'express';
import * as c from '../controllers/userController.js';
import * as profile from '../controllers/profileController.js';
import { verifyToken } from '../middleware/auth/verifyToken.js';
import { requireRole } from '../middleware/auth/requireRole.js';

const r = Router();

// UC-5: member ID always comes from the authenticated session.
r.get('/me', verifyToken, requireRole('member'), profile.view);
r.patch('/me', verifyToken, requireRole('member'), profile.protectProfileWrite, profile.update);

r.get('/', c.list);
r.post('/', c.create);
r.patch('/:id/status', c.status);
r.patch('/:id/points', c.points);
export default r;
