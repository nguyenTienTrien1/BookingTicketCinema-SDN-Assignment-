import * as loginService from '../../services/auth/loginService.js';
import { getCookieOptions } from './loginController.js';

/**
 * Employee and Admin login endpoint handler (UC-18)
 * URL: POST /api/auth/admin/login
 */
export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, token } = await loginService.authenticate(email, password, { allowedRoles: ['employee', 'admin'] });

    res.cookie('token', token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập trang quản trị thành công.',
      user
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Protected Admin Dashboard test endpoint
 * URL: GET /api/admin/dashboard
 */
export function adminDashboard(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Chào mừng quản trị viên đến với trung tâm quản trị hệ thống rạp phim.',
    user: req.user
  });
}

