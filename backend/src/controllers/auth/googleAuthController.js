import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import * as service from '../../services/auth/googleAuthService.js';
import { getJwtSecret } from '../../services/auth/loginService.js';
import { getCookieOptions } from './loginController.js';

const challengeOptions = () => ({ ...getCookieOptions(), path: '/api/auth', maxAge: 5 * 60 * 1000 });
function clearChallenge(res) {
  const options = challengeOptions();
  delete options.maxAge;
  res.clearCookie('googleChallenge', options);
}

export function challenge(req, res, next) {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: 'Đăng nhập Google chưa được cấu hình trên máy chủ.' });
    }
    const purpose = req.body.purpose;
    if (!['login', 'set-password', 'link-google'].includes(purpose) || (purpose !== 'login' && !req.user)) {
      return res.status(400).json({ message: 'Yêu cầu xác thực không hợp lệ.' });
    }
    const nonce = crypto.randomBytes(32).toString('hex');
    const token = jwt.sign({ nonce, purpose, userId: req.user ? String(req.user._id) : null }, getJwtSecret(), { expiresIn: '5m', audience: 'google-challenge' });
    res.cookie('googleChallenge', token, challengeOptions());
    // This is the public Web Client ID already sent to GIS by the browser.
    // Return the running process configuration so the UI can detect stale .env.
    res.json({ nonce, clientId: process.env.GOOGLE_CLIENT_ID.trim() });
  } catch (error) { next(error); }
}

function readNonce(req, purpose) {
  try {
    const proof = jwt.verify(req.cookies.googleChallenge, getJwtSecret(), { algorithms: ['HS256'], audience: 'google-challenge' });
    const userId = req.user ? String(req.user._id) : null;
    if (proof.purpose !== purpose || proof.userId !== userId) throw new Error();
    return proof.nonce;
  } catch {
    throw Object.assign(new Error('Phiên xác thực Google đã hết hạn. Vui lòng thử lại.'), { status: 401 });
  }
}

export async function login(req, res, next) {
  try {
    const result = await service.googleLogin(req.body.credential, readNonce(req, 'login'));
    clearChallenge(res);
    res.cookie('token', result.token, getCookieOptions());
    res.json({ success: true, user: result.user });
  } catch (error) { next(error); }
}

function finishSecurityChange(res, message) {
  clearChallenge(res);
  const options = getCookieOptions();
  delete options.maxAge;
  res.clearCookie('token', options);
  res.json({ success: true, message });
}

export async function setPassword(req, res, next) {
  try {
    await service.setPassword(req.user._id, req.body, readNonce(req, 'set-password'));
    finishSecurityChange(res, 'Đặt mật khẩu thành công. Bạn có thể đăng nhập bằng Google hoặc email và mật khẩu.');
  } catch (error) { next(error); }
}

export async function linkGoogle(req, res, next) {
  try {
    await service.linkGoogle(req.user._id, req.body, readNonce(req, 'link-google'));
    finishSecurityChange(res, 'Liên kết Google thành công. Vui lòng đăng nhập lại.');
  } catch (error) { next(error); }
}
