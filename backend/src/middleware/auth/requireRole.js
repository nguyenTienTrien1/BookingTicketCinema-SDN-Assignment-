/**
 * Middleware factory to enforce role-based access control (BR-11)
 * @param  {...string} allowedRoles Allowed roles ('member', 'employee', 'admin')
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Bạn chưa đăng nhập.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.log(`[AUTH AUDIT] Forbidden: User ${req.user.email} (role: ${req.user.role}) tried to access route restricted to [${allowedRoles.join(', ')}]`);
      return res.status(403).json({ message: 'Bạn không có quyền truy cập vào chức năng này.' });
    }

    next();
  };
}

