import { allowedClientOrigins } from '../../config/clientOrigins.js';
export function validateMobileReturn(value, route = '/payment-return') {
  if (typeof value !== 'string' || value.length > 1500) throw Object.assign(new Error('Địa chỉ quay lại app không hợp lệ.'), { status: 400 });
  let url;
  try { url = new URL(value); } catch { throw Object.assign(new Error('Địa chỉ quay lại app không hợp lệ.'), { status: 400 }); }
  const native = ['exp:', 'exps:', 'cinemaplus:'].includes(url.protocol);
  const preview = process.env.NODE_ENV !== 'production' && ['http:', 'https:'].includes(url.protocol) && allowedClientOrigins().includes(url.origin);
  if ((!native && !preview) || url.username || url.password || url.hash || url.search || !url.pathname.endsWith(route)) throw Object.assign(new Error('Địa chỉ quay lại app không được phép.'), { status: 400 });
  return url.toString();
}
