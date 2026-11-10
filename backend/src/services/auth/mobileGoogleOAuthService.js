import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { createHash } from 'node:crypto';

export function mobileGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_MOBILE_REDIRECT_URI?.trim();
  const unavailable = () => Object.assign(new Error('Đăng nhập Google chưa được cấu hình. Cần GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và GOOGLE_MOBILE_REDIRECT_URI trên backend.'), { status: 503 });
  if (!clientId || !clientSecret || !redirectUri) throw unavailable();
  let url;
  try { url = new URL(redirectUri); } catch { throw unavailable(); }
  const local = process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash || url.pathname !== '/api/auth/mobile/google/callback') throw unavailable();
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export function googleAuthorizationUrl(client, value) {
  return client.generateAuthUrl({
    scope: ['openid', 'email', 'profile'], access_type: 'online', prompt: 'select_account',
    state: value.state, nonce: value.nonce,
    code_challenge: createHash('sha256').update(value.verifier).digest('base64url'),
    code_challenge_method: CodeChallengeMethod.S256
  });
}

export async function googleCodeCredential(client, code, verifier) {
  try {
    const { tokens } = await client.getToken({ code, codeVerifier: verifier });
    if (!tokens.id_token) throw new Error('Missing ID token');
    return tokens.id_token;
  } catch {
    // Library errors can contain codes, secrets or tokens: never expose them.
    throw Object.assign(new Error('Không thể đổi mã xác thực Google. Vui lòng thử lại.'), { status: 401 });
  }
}
