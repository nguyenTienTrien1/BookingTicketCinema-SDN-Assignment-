function unavailable() {
  return Object.assign(new Error('Liên kết mở ứng dụng chưa được cấu hình. Vui lòng thử lại sau.'), { status: 503 });
}

export function publicMobileUrl(pathname) {
  const configured = process.env.PUBLIC_API_URL?.trim() || process.env.GOOGLE_MOBILE_REDIRECT_URI?.trim();
  let url;
  try { url = new URL(configured); } catch { throw unavailable(); }
  const local = process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !local) || url.username || url.password) throw unavailable();
  return new URL(pathname, url).href;
}

export function mobilePasswordResetAppUrl() {
  let url;
  try { url = new URL(process.env.MOBILE_PASSWORD_RESET_APP_URL?.trim() || 'cinemaplus://reset-password'); }
  catch { throw unavailable(); }
  const installed = url.protocol === 'cinemaplus:' &&
    ((url.hostname === 'reset-password' && ['', '/'].includes(url.pathname)) || (!url.hostname && url.pathname === '/reset-password'));
  const expo = process.env.NODE_ENV !== 'production' && ['exp:', 'exps:'].includes(url.protocol) && url.hostname && url.pathname === '/--/reset-password';
  if ((!installed && !expo) || url.username || url.password || url.search || url.hash) throw unavailable();
  // The destination comes only from backend configuration, never a request
  // returnTo/redirect parameter that could leak a reset token to another app.
  return url;
}
