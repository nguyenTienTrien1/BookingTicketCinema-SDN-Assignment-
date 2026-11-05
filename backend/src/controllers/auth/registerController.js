import * as registerService from '../../services/auth/registerService.js';

/**
 * Register Member endpoint handler (UC-1)
 * URL: POST /api/auth/register
 */
export async function register(req, res, next) {
  try {
    const result = await registerService.registerMember(req.body);
    return res.status(201).json({
      success: true,
      ...publicResult(result)
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify Email endpoint handler (UC-1, BR-8)
 * URL: GET /api/auth/verify-email?token=xyz OR POST /api/auth/verify-email
 */
export async function verifyEmail(req, res, next) {
  try {
    const token = req.query.token || req.body.token;
    const result = await registerService.verifyEmail(token);
    return res.status(200).json(publicResult(result));
  } catch (error) {
    next(error);
  }
}

/**
 * Resend Verification endpoint handler (BR-8)
 * URL: POST /api/auth/resend-verification
 */
export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;
    const result = await registerService.resendVerification(email);
    return res.status(200).json(publicResult(result));
  } catch (error) {
    next(error);
  }
}


function publicResult(result) {
  if (process.env.NODE_ENV !== 'production') return result;
  const safe = { ...result };
  delete safe.verificationToken;
  delete safe.verificationLink;
  delete safe.previewUrl;
  return safe;
}
