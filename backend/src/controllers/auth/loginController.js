import * as loginService from '../../services/auth/loginService.js';

// Cookie configuration
export const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000 // 1 day
});

/**
 * Member login endpoint (UC-18)
 * URL: POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, token } = await loginService.authenticate(email, password, { allowedRoles: ['member'] });

    // Issue JWT inside HttpOnly cookie (Security Requirement)
    res.cookie('token', token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công.',
      user
    });
  } catch (error) {
    next(error);
  }
}

// Native clients send this session in Authorization rather than browser cookies.
export async function mobileLogin(req, res, next) {
  try {
    const { user, token } = await loginService.authenticate(req.body?.email, req.body?.password, { allowedRoles: ['member'] });
    res.set('Cache-Control', 'no-store').json({ success: true, user, token });
  } catch (error) { next(error); }
}

export async function mobileStaffLogin(req, res, next) {
  try {
    const { user, token } = await loginService.authenticate(req.body?.email, req.body?.password, { allowedRoles: ['employee', 'admin'] });
    res.set('Cache-Control', 'no-store').json({ success: true, user, token });
  } catch (error) { next(error); }
}

/**
 * Logout handler - clears session cookie
 * URL: POST /api/auth/logout
 */
export function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  return res.status(200).json({
    success: true,
    message: 'Đăng xuất thành công.'
  });
}

/**
 * Get current authenticated account
 * URL: GET /api/auth/me
 */
export function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user
  });
}

/**
 * Protected Member Dashboard test endpoint
 * URL: GET /api/member/dashboard
 */
export function memberDashboard(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Chào mừng bạn đến với khu vực thành viên rạp chiếu phim.',
    user: req.user
  });
}

/**
 * Protected Employee Dashboard test endpoint
 * URL: GET /api/employee/dashboard
 */
export function employeeDashboard(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Chào mừng nhân viên đến với giao diện tác nghiệp quầy vé.',
    user: req.user
  });
}

