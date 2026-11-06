import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';
import { authenticate, createSession } from './loginService.js';

export const googleClient = new OAuth2Client();
const DENIED = 'Không thể xác thực tài khoản. Vui lòng đăng nhập lại.';
// Match google-auth-library's standard five-minute clock-skew allowance.
// A token issued moments ago by Google must not fail on a slightly slow PC.
const GOOGLE_CLOCK_SKEW_SECONDS = 300;
const RECENT_GOOGLE_AUTH_SECONDS = 300;

function fail(message = DENIED, status = 401) {
  return Object.assign(new Error(message), { status });
}

export async function verifyGoogleCredential(credential, nonce) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw fail('Đăng nhập Google chưa được cấu hình trên máy chủ.', 503);
  if (typeof credential !== 'string' || !credential || credential.length > 16384 || !nonce) throw fail();
  let claims;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    claims = ticket.getPayload();
  } catch (error) {
    // Google library errors can contain the entire JWT. Log fixed reason codes
    // only; never log the original error, token, payload, email or subject.
    let reason = 'TOKEN_VERIFICATION_FAILED';
    if (error.message.startsWith('Wrong recipient')) reason = 'AUDIENCE_MISMATCH';
    else if (error.message.startsWith('Token used too late')) reason = 'TOKEN_EXPIRED';
    else if (error.message.startsWith('Token used too early')) reason = 'TOKEN_NOT_YET_VALID';
    else if (error.message.startsWith('Failed to retrieve verification certificates')) reason = 'CERTIFICATES_UNAVAILABLE';
    console.warn('[GOOGLE AUTH]', reason);
    throw fail('Xác thực Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (!claims || claims.aud !== clientId ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
      !Number.isInteger(claims.exp) || claims.exp <= now ||
      !Number.isInteger(claims.iat) || claims.iat > now + GOOGLE_CLOCK_SKEW_SECONDS || now - claims.iat > RECENT_GOOGLE_AUTH_SECONDS ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 ||
      claims.email_verified !== true || typeof claims.email !== 'string' ||
      claims.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) || claims.nonce !== nonce) {
    console.warn('[GOOGLE AUTH] CLAIMS_REJECTED', {
      audienceMatches: claims?.aud === clientId,
      nonceMatches: claims?.nonce === nonce,
      recentAuthentication: Number.isInteger(claims?.iat) && claims.iat <= now + GOOGLE_CLOCK_SKEW_SECONDS && now - claims.iat <= RECENT_GOOGLE_AUTH_SECONDS,
      unexpired: Number.isInteger(claims?.exp) && claims.exp > now,
      emailVerified: claims?.email_verified === true
    });
    throw fail('Xác thực Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
  }
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), name: claims.name };
}

function activeMemberFilter(account) {
  return {
    _id: account._id, role: 'member', status: { $in: ['Active', 'active'] },
    tokenVersion: { $in: [account.tokenVersion || 0, null] },
    $or: [{ lockUntil: null }, { lockUntil: { $lte: new Date() } }]
  };
}

function checkMember(account) {
  if (!account || account.role !== 'member' || !['Active', 'active'].includes(account.status) ||
      (account.lockUntil && account.lockUntil > new Date())) throw fail();
}

function collision() {
  return fail('Không thể đăng nhập Google. Nếu đã có tài khoản Cinema+, hãy đăng nhập bằng email và mật khẩu, rồi liên kết Google trong Hồ sơ → Bảo mật.', 409);
}

export async function googleLogin(credential, nonce) {
  const identity = await verifyGoogleCredential(credential, nonce);
  let account = await User.findOne({ googleId: identity.sub }).select('+googleId');
  if (!account) {
    const emailAccount = await User.findOne({ email: identity.email }).select('+googleId');
    if (emailAccount) {
      // A concurrent Google login can finish between the subject and email
      // lookups. Only an already-linked identical subject may reuse this record.
      if (emailAccount.googleId !== identity.sub) throw collision();
      account = emailAccount;
    }
  }
  if (!account) {
    try {
      account = await User.create({
        fullName: typeof identity.name === 'string' && identity.name.trim() ? identity.name.trim().slice(0, 100) : identity.email,
        email: identity.email, googleId: identity.sub, googleEmail: identity.email,
        role: 'member', status: 'Active'
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      // Another request may have created this identity while this request waited.
      account = await User.findOne({ googleId: identity.sub }).select('+googleId');
      if (!account) throw collision();
    }
  }
  checkMember(account);
  const updated = await User.findOneAndUpdate(
    { ...activeMemberFilter(account), googleId: identity.sub },
    { $set: { failedLoginAttempts: 0, lockUntil: null, lastLogin: new Date() } },
    { new: true }
  );
  if (!updated) throw fail();
  return createSession(updated);
}

export async function setPassword(userId, data, nonce) {
  const { newPassword, confirmPassword, credential } = data;
  if (typeof newPassword !== 'string' || newPassword.length < 6 || !newPassword.trim() || Buffer.byteLength(newPassword, 'utf8') > 72) {
    throw fail('Mật khẩu mới cần ít nhất 6 ký tự và không quá 72 byte UTF-8.', 400);
  }
  if (newPassword !== confirmPassword) throw fail('Xác nhận mật khẩu mới không khớp.', 400);
  const account = await User.findById(userId).select('+googleId');
  checkMember(account);
  if (account.password || !account.googleId) throw fail('Tài khoản không đủ điều kiện đặt mật khẩu.', 409);
  const identity = await verifyGoogleCredential(credential, nonce);
  if (identity.sub !== account.googleId) throw fail();
  // updateOne does not run pre-save: hash exactly once, then conditionally save.
  const password = await bcrypt.hash(newPassword, 10);
  const result = await User.updateOne({
    ...activeMemberFilter(account), googleId: identity.sub, password: null
  }, { $set: { password }, $inc: { tokenVersion: 1 } }, { runValidators: true });
  if (result.modifiedCount !== 1) throw fail('Thông tin tài khoản vừa thay đổi. Vui lòng đăng nhập lại.', 409);
  console.log(`[AUTH AUDIT] Local password configured for user=${userId}`);
}

export async function linkGoogle(userId, data, nonce) {
  const account = await User.findById(userId).select('+googleId');
  checkMember(account);
  if (!account.password || account.googleId) throw fail('Tài khoản không đủ điều kiện liên kết Google.', 409);
  // Always require the local password, including for a recent session. This also
  // reuses BR-7 counters instead of creating a password-guessing bypass.
  const local = await authenticate(account.email, data.currentPassword, { reauthentication: true });
  if (String(local._id) !== String(userId)) throw fail();
  const identity = await verifyGoogleCredential(data.credential, nonce);
  if (identity.email !== account.email) throw fail('Vui lòng chọn Google có cùng email với tài khoản Cinema+.', 400);
  if (await User.exists({ googleId: identity.sub })) throw fail('Không thể liên kết tài khoản Google này.', 409);
  try {
    const result = await User.updateOne({
      ...activeMemberFilter(account), password: local.password, googleId: null
    }, { $set: { googleId: identity.sub, googleEmail: identity.email }, $inc: { tokenVersion: 1 } }, { runValidators: true });
    if (result.modifiedCount !== 1) throw fail('Thông tin tài khoản vừa thay đổi. Vui lòng đăng nhập lại.', 409);
  } catch (error) {
    if (error.code === 11000) throw fail('Không thể liên kết tài khoản Google này.', 409);
    throw error;
  }
  console.log(`[AUTH AUDIT] Google linked for user=${local._id}`);
}
