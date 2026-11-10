import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { googleLogin, linkGoogle } from '../../services/auth/googleAuthService.js';
import { getJwtSecret, verifySessionToken } from '../../services/auth/loginService.js';
import { mobileGoogleClient, googleAuthorizationUrl, googleCodeCredential } from '../../services/auth/mobileGoogleOAuthService.js';
import { validateMobileReturn } from '../../services/payments/mobileReturn.js';

// Single-process, five-minute handoffs. Only the initiating app knows the secret.
// Provider tokens and Cinema+ JWTs never appear in app return URLs.
const pending = new Map();
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const cookiePath = '/api/auth/mobile/google';
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function entry(id) {
  const value = pending.get(id);
  if (!value || value.expires <= Date.now()) { pending.delete(id); throw fail('Phiên Google đã hết hạn. Vui lòng thử lại.', 410); }
  return value;
}
function browserProof(req, id) {
  let proof;
  try { proof = jwt.verify(req.cookies.mobileGoogle || '', getJwtSecret(), { algorithms: ['HS256'], audience: 'mobile-google' }); }
  catch { throw fail('Phiên trình duyệt không hợp lệ hoặc đã hết hạn.', 401); }
  if (proof.id !== id) throw fail('Phiên trình duyệt không hợp lệ.', 401);
}
function appProof(req, value) {
  if (typeof req.body?.secret !== 'string' || req.body.secret.length !== 64 || !timingSafeEqual(createHash('sha256').update(req.body.secret).digest(), value.hash)) throw fail('Mã chuyển phiên không hợp lệ.', 401);
}
function html(res, content, script = '') {
  return res.set(headers).type('html').send(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CINEMA+ Google</title><style>body{background:#090b10;color:white;font:17px system-ui;max-width:420px;margin:12vh auto;padding:24px}h1,a{color:#ff8ba2}input,button{box-sizing:border-box;display:block;width:100%;padding:14px;margin:16px 0;font:inherit;border-radius:8px}button{cursor:pointer}#message{line-height:1.6}</style><h1>CINEMA+</h1>${content}${script ? `<script>${script}</script>` : ''}</html>`);
}
function finish(res, value, message) {
  const returnTo = value.returnTo;
  const script = returnTo ? `if(window.opener){window.close()}else{location.replace(${JSON.stringify(returnTo).replaceAll('<', '\\u003c')})}` : '';
  return html(res, `<h2>${value.error ? 'Chưa đăng nhập được' : 'Xác thực thành công'}</h2><p id="message">${escape(message)}</p>${returnTo ? `<a href="${escape(returnTo)}">Quay lại CINEMA+</a>` : '<p>Bạn có thể đóng trang này và quay lại app.</p>'}`, script);
}
export async function begin(req, res, next) {
  try {
    const client = mobileGoogleClient();
    const purpose = req.body?.purpose || 'login';
    if (!['login', 'link-google'].includes(purpose)) throw fail('Mục đích xác thực không hợp lệ.');
    let userId = null;
    if (purpose === 'link-google') {
      const session = await verifySessionToken(req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
      if (!session || session.role !== 'member') throw fail('Cần đăng nhập thành viên để liên kết Google.', 401);
      userId = String(session._id);
    }
    for (const [id, value] of pending) if (value.expires <= Date.now()) pending.delete(id);
    if (pending.size >= 1000) throw fail('Máy chủ đang bận. Vui lòng thử lại.', 503);
    const id = randomBytes(24).toString('hex'), secret = randomBytes(32).toString('hex');
    const returnTo = req.body?.returnTo ? validateMobileReturn(req.body.returnTo, '/auth-return') : null;
    const expires = Date.now() + 300000;
    pending.set(id, {
      hash: createHash('sha256').update(secret).digest(), nonce: randomBytes(32).toString('hex'),
      state: `${id}.${randomBytes(32).toString('hex')}`, verifier: randomBytes(32).toString('base64url'),
      expires, returnTo, purpose, userId
    });
    // Open the browser on the callback origin even when app API calls use a LAN IP.
    const browserUrl = new URL(`${cookiePath}/${id}`, client.redirectUri).href;
    res.set(headers).json({ id, secret, expiresAt: expires, browserUrl });
  } catch (error) { next(error); }
}
export function page(req, res, next) {
  try {
    const value = entry(req.params.id);
    if (value.started) throw fail('Phiên đã được mở. Vui lòng bắt đầu lại từ app.', 409);
    const client = mobileGoogleClient();
    value.started = true;
    res.cookie('mobileGoogle', jwt.sign({ id: req.params.id }, getJwtSecret(), { expiresIn: '5m', audience: 'mobile-google' }), {
      httpOnly: true, sameSite: 'lax', secure: client.redirectUri.startsWith('https:'), path: cookiePath, maxAge: 300000
    });
    res.set(headers).redirect(googleAuthorizationUrl(client, value));
  } catch (error) { next(error); }
}
export async function callback(req, res, next) {
  let value, accepted = false, processing = false;
  try {
    const state = req.query.state;
    if (typeof state !== 'string' || !/^[a-f0-9]{48}\.[a-f0-9]{64}$/.test(state)) throw fail('Phiên OAuth không hợp lệ.', 401);
    const id = state.slice(0, 48);
    value = entry(id);
    browserProof(req, id);
    if (!value.started || !timingSafeEqual(Buffer.from(state), Buffer.from(value.state))) throw fail('Phiên OAuth không hợp lệ.', 401);
    if (value.callbackUsed || value.processing) throw fail('Mã xác thực đã được sử dụng.', 409);
    value.callbackUsed = true;
    accepted = true;
    if (req.query.error) throw fail(req.query.error === 'access_denied' ? 'Bạn đã hủy đăng nhập Google.' : 'Google không thể xác thực. Vui lòng thử lại.');
    if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 4096) throw fail('Thiếu mã xác thực Google.');
    value.processing = processing = true;
    const credential = await googleCodeCredential(mobileGoogleClient(), req.query.code, value.verifier);
    if (pending.get(id) !== value || value.expires <= Date.now()) throw fail('Phiên Google đã kết thúc.', 410);
    if (value.purpose === 'link-google') {
      value.credential = credential;
      const endpoint = JSON.stringify(`${cookiePath}/${id}/complete`);
      return html(res, '<h2>Xác nhận liên kết Google</h2><p>Nhập mật khẩu CINEMA+ hiện tại để xác nhận liên kết. Google phải có cùng email với tài khoản của bạn.</p><form id="link"><label for="password">Mật khẩu CINEMA+</label><input id="password" type="password" autocomplete="current-password" required><button>Liên kết Google</button></form><p id="message" role="alert"></p>', `document.getElementById('link').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const response=await fetch(${endpoint},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:document.getElementById('password').value})});const data=await response.json();document.getElementById('message').textContent=data.message;if(response.ok){if(window.opener){window.close()}else if(data.returnTo){location.replace(data.returnTo)}}}catch{document.getElementById('message').textContent='Mất kết nối. Vui lòng thử lại.'}finally{button.disabled=false}}`);
    }
    value.result = await googleLogin(credential, value.nonce, { allowRegistration: true });
    return finish(res, value, 'Đăng nhập thành công. Quay lại app để tiếp tục.');
  } catch (error) {
    // A callback without valid state AND browser binding cannot terminate a handoff.
    if (accepted) {
      value.error = { status: error.status < 500 ? error.status : 503, message: error.status < 500 ? error.message : 'Không thể đăng nhập Google. Vui lòng thử lại.' };
      return finish(res, value, value.error.message);
    }
    next(error);
  } finally { if (processing) value.processing = false; }
}
export async function complete(req, res, next) {
  try {
    if (!req.is('application/json') || req.get('Sec-Fetch-Site') === 'cross-site') throw fail('Nguồn yêu cầu không hợp lệ.', 403);
    browserProof(req, req.params.id);
    const value = entry(req.params.id);
    if (value.purpose !== 'link-google' || !value.credential || value.error) throw fail('Phiên liên kết Google không hợp lệ.', 409);
    if (value.result || value.processing) throw fail('Phiên đã được xác thực.', 409);
    value.processing = true;
    try {
      value.result = await linkGoogle(value.userId, { credential: value.credential, currentPassword: req.body?.currentPassword }, value.nonce);
      delete value.credential;
    } finally { value.processing = false; }
    res.set(headers).json({ message: 'Đã liên kết Google. Quay lại app để tiếp tục.', returnTo: value.returnTo });
  } catch (error) { next(error); }
}
export function exchange(req, res, next) {
  try {
    const value = entry(req.params.id);
    appProof(req, value);
    res.set(headers);
    if (value.error) { pending.delete(req.params.id); throw fail(value.error.message, value.error.status); }
    if (!value.result) return res.status(202).json({ status: 'pending' });
    pending.delete(req.params.id);
    res.json({ status: 'complete', ...value.result });
  } catch (error) { next(error); }
}
export function cancel(req, res, next) {
  try {
    const value = entry(req.params.id);
    appProof(req, value);
    pending.delete(req.params.id);
    res.set(headers).sendStatus(204);
  } catch (error) { next(error); }
}
