import { trustedClientRequest } from '../../config/clientOrigins.js';
import * as profileService from "../../services/users/profileService.js";

// JSON and Origin/Fetch Metadata checks protect cookie-authenticated writes.
export function protectProfileWrite(req, res, next) {
  if (!trustedClientRequest(req)) {
    return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
  }
  if (!req.is('application/json')) {
    return res.status(415).json({ message: 'Yêu cầu phải dùng application/json.' });
  }
  next();
}

export async function view(req, res, next) {
  try {
    const user = await profileService.getProfile(req.user._id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const user = await profileService.updateProfile(req.user._id, req.body);
    res.json({ message: 'Cập nhật hồ sơ thành công.', user });
  } catch (error) {
    next(error);
  }
}

export async function password(req, res, next) {
  try {
    await profileService.changePassword(req.user._id, req.body);
    res.clearCookie('token', {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production'
    });
    res.json({ message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' });
  } catch (error) {
    next(error);
  }
}
