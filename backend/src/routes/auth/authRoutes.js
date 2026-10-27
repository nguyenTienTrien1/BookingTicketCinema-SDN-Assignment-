import { Router } from 'express';
import { login, logout, getCurrentUser } from '../../controllers/auth/loginController.js';
import { adminLogin } from '../../controllers/auth/adminLoginController.js';
import { verifyToken } from '../../middleware/auth/verifyToken.js';

const router = Router();

// Public login routes
router.post('/login', login);
router.post('/admin/login', adminLogin);

// Session routes
router.post('/logout', logout);
router.get('/me', verifyToken, getCurrentUser);

export default router;

