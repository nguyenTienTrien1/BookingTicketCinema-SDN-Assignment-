import { Router } from 'express';
import { login, logout, getCurrentUser } from '../../controllers/auth/loginController.js';
import { adminLogin } from '../../controllers/auth/adminLoginController.js';
import { register, verifyEmail, resendVerification } from '../../controllers/auth/registerController.js';
import { verifyToken } from '../../middleware/auth/verifyToken.js';

const router = Router();

// Public login routes
router.post('/login', login);
router.post('/admin/login', adminLogin);

// UC-1: Member Registration & Email Verification (BR-1, BR-8)
router.post('/register', register);
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

// Session routes
router.post('/logout', logout);
router.get('/me', verifyToken, getCurrentUser);

export default router;

