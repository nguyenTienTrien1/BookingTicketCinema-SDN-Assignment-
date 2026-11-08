import {activateStaff} from '../../services/staffService.js';
import { Router } from 'express';
import { login, logout, getCurrentUser } from '../../controllers/auth/loginController.js';
import { adminLogin } from '../../controllers/auth/adminLoginController.js';
import { register, verifyEmail, resendVerification } from '../../controllers/auth/registerController.js';
import { verifyToken } from '../../middleware/auth/verifyToken.js';
import { forgotPassword, verifyPasswordReset, resetPassword } from '../../controllers/auth/passwordResetController.js';
import { createPasswordResetLimiter } from '../../middleware/auth/passwordResetRateLimit.js';
import * as google from '../../controllers/auth/googleAuthController.js';
import { protectProfileWrite } from '../../controllers/profileController.js';
import { requireRole } from '../../middleware/auth/requireRole.js';

const router = Router();

const googleLimit = createPasswordResetLimiter(60, 15 * 60 * 1000);
router.post('/google/challenge', googleLimit, protectProfileWrite, google.challenge);
router.post('/google/reauth-challenge', googleLimit, protectProfileWrite, verifyToken, requireRole('member'), google.challenge);
router.post('/google', googleLimit, protectProfileWrite, google.login);
router.post('/set-password', googleLimit, protectProfileWrite, verifyToken, requireRole('member'), google.setPassword);
router.post('/link-google', googleLimit, protectProfileWrite, verifyToken, requireRole('member'), google.linkGoogle);

// Public login routes
router.post('/login', login);
router.post('/admin/login', adminLogin);

// UC-1: Member Registration & Email Verification (BR-1, BR-8)
router.post('/register', register);
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

// UC-19: public recovery; the opaque email token grants permission to reset.
router.post('/forgot-password', createPasswordResetLimiter(10, 15 * 60 * 1000), forgotPassword);
const resetLimit = createPasswordResetLimiter(60, 15 * 60 * 1000);
router.get('/reset-password/verify', resetLimit, verifyPasswordReset);
router.post('/reset-password', resetLimit, resetPassword);

// Session routes
router.post('/logout', logout);
router.get('/me', verifyToken, getCurrentUser);

router.post('/activate-staff',async(req,res,next)=>{try{res.json(await activateStaff(req.body.token,req.body.password,req.body.confirmPassword));}catch(e){next(e);}});
export default router;

