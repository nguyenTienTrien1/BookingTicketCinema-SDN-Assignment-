import { verifySessionToken } from '../../services/auth/loginService.js';

/**
 * Middleware to verify JWT token from HttpOnly cookie or Authorization header
 */
export async function verifyToken(req, res, next) {
  try {
    let token = null;

    // 1. Check HttpOnly cookie first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Fallback to Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({ message: 'Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.' });
    }

    const user = await verifySessionToken(token);
    if (!user) {
      // Clear invalid cookie
      res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });
      return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

