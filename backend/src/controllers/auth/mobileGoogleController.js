import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { googleLogin, linkGoogle } from '../../services/auth/googleAuthService.js';
import { getJwtSecret, verifySessionToken } from '../../services/auth/loginService.js';
import { validateMobileReturn } from '../../services/payments/mobileReturn.js';

// Short-lived handoffs for this single-process API. Only the initiating phone
// knows the exchange secret; neither the browser nor a URL receives a JWT.
const pending = new Map();
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function entry(id) {
  const value = pending.get(id);
  if (!value || value.expires < Date.now()) { pending.delete(id); throw fail('Phiên Google đã hết hạn. Vui lòng thử lại.', 410); }
  return value;
}
export async function begin(req, res, next) {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) throw fail('Chưa cấu hình GOOGLE_CLIENT_ID trên backend.', 503);
    const purpose=req.body?.purpose||'login';
    if(!['login','link-google'].includes(purpose))throw fail('Mục đích xác thực không hợp lệ.');
    let userId=null;
    if(purpose==='link-google') {
      const session=await verifySessionToken(req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):null);
      if(!session||session.role!=='member')throw fail('Cần đăng nhập thành viên để liên kết Google.',401);
      userId=String(session._id);
    }
    for (const [id, value] of pending) if (value.expires < Date.now()) pending.delete(id);
    if (pending.size >= 1000) throw fail('Máy chủ đang bận. Vui lòng thử lại.', 503);
    const id = randomBytes(24).toString('hex'), secret = randomBytes(32).toString('hex');
    const returnTo = req.body?.returnTo ? validateMobileReturn(req.body.returnTo, '/auth-return') : null;
    pending.set(id, { hash: createHash('sha256').update(secret).digest(), nonce: randomBytes(32).toString('hex'), expires: Date.now() + 300000, returnTo, purpose, userId });
    res.set('Cache-Control', 'no-store').json({ id, secret, browserPath: `/auth/mobile/google/${id}` });
  } catch (error) { next(error); }
}
export function page(req, res, next) {
  try {
    const value = entry(req.params.id);
    res.cookie('mobileGoogle', jwt.sign({ id: req.params.id }, getJwtSecret(), { expiresIn: '5m', audience: 'mobile-google' }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/auth/mobile/google', maxAge: 300000 });
    const config = JSON.stringify({ client_id: process.env.GOOGLE_CLIENT_ID.trim(), nonce: value.nonce }).replaceAll('<', '\\u003c');
    const completion = JSON.stringify(`/api/auth/mobile/google/${req.params.id}/complete`);
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }).type('html').send(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CINEMA+ Google</title><style>body{background:#090b10;color:white;font:17px system-ui;max-width:420px;margin:12vh auto;padding:24px}h1{color:#ff6483}#google{margin:32px 0}a{color:#ff8ba2}</style><h1>CINEMA+</h1><h2>Đăng nhập bằng Google</h2><p id="message">Chọn tài khoản Google đã liên kết, hoặc tài khoản mới.</p>${value.purpose==='link-google'?'<label>Current Cinema+ password<input id="password" type="password" autocomplete="current-password" style="display:block;padding:12px;margin:12px 0"></label>':''}<div id="google"></div><script>window.initGoogle=()=>{google.accounts.id.initialize({...${config},callback:async r=>{const response=await fetch(${completion},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:r.credential,currentPassword:document.getElementById('password')?.value})});const data=await response.json();document.getElementById('message').textContent=data.message||'Xác thực thất bại';if(data.returnTo){const a=document.createElement('a');a.href=data.returnTo;a.textContent='Quay lại Expo Go';document.body.appendChild(a);location.href=data.returnTo}}});google.accounts.id.renderButton(document.getElementById('google'),{theme:'outline',size:'large'})};</script><script src="https://accounts.google.com/gsi/client" async defer onload="initGoogle()"></script></html>`);
  } catch (error) { next(error); }
}
export async function complete(req, res, next) {
  try {
    if (!req.is('application/json') || req.get('Sec-Fetch-Site') === 'cross-site') throw fail('Nguồn yêu cầu không hợp lệ.', 403);
    let proof;
    try { proof = jwt.verify(req.cookies.mobileGoogle || '', getJwtSecret(), { algorithms: ['HS256'], audience: 'mobile-google' }); }
    catch { throw fail('Phiên trình duyệt không hợp lệ hoặc đã hết hạn.', 401); }
    if (proof.id !== req.params.id) throw fail('Phiên trình duyệt không hợp lệ.', 401);
    const value = entry(req.params.id);
    if (value.result || value.processing) throw fail('Phiên đã được xác thực.', 409);
    value.processing = true;
    try { value.result = value.purpose==='link-google'?await linkGoogle(value.userId,{credential:req.body?.credential,currentPassword:req.body?.currentPassword},value.nonce):await googleLogin(req.body?.credential, value.nonce); }
    finally { value.processing = false; }
    res.set('Cache-Control', 'no-store').json({ message: 'Đăng nhập thành công. Quay lại app để tiếp tục.', returnTo: value.returnTo });
  } catch (error) { next(error); }
}
export function exchange(req, res, next) {
  try {
    const value = entry(req.params.id);
    if (typeof req.body?.secret !== 'string' || req.body.secret.length !== 64 || !timingSafeEqual(createHash('sha256').update(req.body.secret).digest(), value.hash)) throw fail('Mã chuyển phiên không hợp lệ.', 401);
    res.set('Cache-Control', 'no-store');
    if (!value.result) return res.status(202).json({ status: 'pending' });
    pending.delete(req.params.id);
    res.json({ status: 'complete', ...value.result });
  } catch (error) { next(error); }
}
