import { randomBytes } from 'node:crypto';
import { publicMobileUrl, mobilePasswordResetAppUrl } from '../../config/mobileLinks.js';
import { requestPasswordReset, verifyPasswordResetToken, RESET_REQUEST_MESSAGE } from '../../services/auth/passwordResetService.js';

export async function forgot(req, res, next) {
  try {
    mobilePasswordResetAppUrl();
    await requestPasswordReset(req.body, { resetBaseUrl: publicMobileUrl('/api/auth/mobile/reset-password') });
    res.set('Cache-Control', 'no-store').json({ success: true, message: RESET_REQUEST_MESSAGE });
  } catch (error) { next(error); }
}

export async function open(req, res) {
  let status = 200, title = 'Mở CINEMA+ để đặt lại mật khẩu', content, script = '';
  const nonce = randomBytes(18).toString('base64');
  try {
    const target = mobilePasswordResetAppUrl();
    // Email scanners/browser previews may open this page. Validation alone must
    // never consume the token; only submitting the password form does that.
    await verifyPasswordResetToken(req.query.token);
    target.searchParams.set('token', req.query.token);
    const href = target.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    content = `<p>Đang chuyển bạn đến màn đặt mật khẩu mới trong ứng dụng.</p><a href="${href}">Mở ứng dụng CINEMA+</a><p>Nếu Gmail chưa tự mở ứng dụng, hãy bấm nút trên. Khi thử bằng Expo Go, hãy giữ Expo đang chạy trên máy tính và mở Expo Go trên điện thoại.</p>`;
    script = `history.replaceState(null,'',location.pathname);location.replace(${JSON.stringify(target.href).replaceAll('<', '\\u003c')});`;
  } catch (error) {
    status = error.status === 400 ? 400 : 503;
    title = status === 400 ? 'Liên kết đặt lại mật khẩu không hợp lệ' : 'Chưa thể mở ứng dụng';
    content = status === 400 ? '<p>Liên kết đã hết hạn, đã sử dụng hoặc không hợp lệ. Vui lòng quay lại ứng dụng, chọn Quên mật khẩu và yêu cầu email mới.</p>' : '<p>Hiện chưa thể mở màn đặt lại mật khẩu. Vui lòng thử lại sau.</p>';
  }
  res.status(status).set({
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`
  }).type('html').send(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · CINEMA+</title><style>body{margin:0;background:#090b10;color:#f5f5fa;font:17px/1.65 system-ui;padding:48px 24px}main{max-width:480px;margin:8vh auto;padding:28px;border:1px solid #303340;border-radius:20px;background:#141720}header{font-size:25px;font-weight:800}header span{color:#ff416d}h1{font-size:26px;line-height:1.3;margin-top:28px}p{color:#bec3d2}a{display:block;padding:14px 20px;background:#ee285b;border-radius:12px;color:white;font-weight:700;text-align:center;text-decoration:none}</style></head><body><main><header>CINEMA<span>+</span></header><h1>${title}</h1>${content}</main>${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`);
}
