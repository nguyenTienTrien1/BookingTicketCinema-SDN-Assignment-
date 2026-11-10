import * as registration from '../../services/auth/registerService.js';
import { publicMobileUrl } from '../../config/mobileLinks.js';

function verificationBaseUrl() {
  return publicMobileUrl('/api/auth/mobile/verify-email');
}
function safeResult(result) {
  const { verificationToken, verificationLink, previewUrl, ...safe } = result;
  return safe;
}
export async function register(req, res, next) {
  try {
    const result = await registration.registerMember(req.body, { verificationBaseUrl: verificationBaseUrl() });
    res.set('Cache-Control', 'no-store').status(201).json({ success: true, ...safeResult(result) });
  } catch (error) { next(error); }
}
export async function resend(req, res, next) {
  try {
    const result = await registration.resendVerification(req.body?.email, { verificationBaseUrl: verificationBaseUrl() });
    res.set('Cache-Control', 'no-store').json(safeResult(result));
  } catch (error) { next(error); }
}
export async function verify(req, res) {
  let status = 200, title = 'Xác minh email thành công', message;
  try {
    await registration.verifyEmail(req.query.token);
    message = 'Tài khoản CINEMA+ đã được kích hoạt. Bạn có thể đóng trang này, quay lại ứng dụng và đăng nhập bằng email cùng mật khẩu đã đăng ký.';
  } catch (error) {
    status = error.status === 400 ? 400 : 503;
    title = 'Chưa xác minh được email';
    message = status === 400 ? 'Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Nếu đã xác minh trước đó, hãy quay lại ứng dụng để đăng nhập. Nếu chưa, hãy yêu cầu gửi lại email xác minh và mở liên kết mới nhất.' : 'Hiện chưa thể xác minh email. Vui lòng mở lại liên kết sau ít phút.';
  }
  res.status(status).set({
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
  }).type('html').send(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · CINEMA+</title><style>body{margin:0;background:#090b10;color:#f5f5fa;font:17px/1.65 system-ui;padding:48px 24px}main{max-width:480px;margin:8vh auto;padding:28px;border:1px solid #303340;border-radius:20px;background:#141720}header{font-size:25px;font-weight:800}header span{color:#ff416d}h1{font-size:26px;line-height:1.3;margin-top:28px}p{color:#bec3d2}</style></head><body><main><header>CINEMA<span>+</span></header><h1>${title}</h1><p>${message}</p></main></body></html>`);
}
