import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';
import { sendPasswordResetEmail } from '../email/emailService.js';

export const RESET_REQUEST_MESSAGE = 'Nếu email đủ điều kiện tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.';
export const INVALID_RESET_MESSAGE = 'Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.';
const REQUEST_COOLDOWN_MS = 60 * 1000;

function invalidInput(message) {
  const error = new Error(message);
  error.status = 400;
  if (message === INVALID_RESET_MESSAGE) error.code = 'RESET_LINK_INVALID';
  throw error;
}

function tokenHash(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) invalidInput(INVALID_RESET_MESSAGE);
  return crypto.createHash('sha256').update(token).digest('hex');
}

function activeMember() {
  return { role: 'member', status: { $in: ['Active', 'active'] } };
}

function usableToken(hash, now) {
  return {
    ...activeMember(),
    passwordResetTokenHash: hash,
    passwordResetExpiresAt: { $gt: now },
    passwordResetUsedAt: null,
    // A normal password change already increments tokenVersion. It therefore
    // also invalidates reset links issued before that change, without a refactor.
    $expr: { $eq: ['$passwordResetTokenVersion', { $ifNull: ['$tokenVersion', 0] }] }
  };
}

function resetConfiguration() {
  // Technical defaults allowed by the task; not the BR-8 registration expiry.
  const minutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30);
  const clientUrl = new URL(process.env.CLIENT_URL || '');
  if (!Number.isSafeInteger(minutes) || minutes <= 0 ||
      !['http:', 'https:'].includes(clientUrl.protocol) || clientUrl.username || clientUrl.password) {
    throw new Error('Invalid password reset configuration.');
  }
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  if (Number.isNaN(expiresAt.getTime())) throw new Error('Invalid password reset expiry.');
  return { minutes, expiresAt, resetUrl: new URL('/reset-password', clientUrl) };
}

export async function requestPasswordReset(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.email !== 'string' ||
      data.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    invalidInput('Địa chỉ email không hợp lệ.');
  }
  const email = data.email.trim().toLowerCase();
  try {
    const config = resetConfiguration();
    const account = await User.findOne({ email, ...activeMember() }).select('_id email tokenVersion');
    if (!account) return;

    const token = crypto.randomBytes(32).toString('hex');
    const hash = tokenHash(token);
    const version = account.tokenVersion || 0;
    const now = new Date();
    const issued = await User.updateOne({
      _id: account._id, email, ...activeMember(),
      tokenVersion: { $in: [version, null] },
      $or: [{ passwordResetRequestedAt: null }, { passwordResetRequestedAt: { $lte: new Date(now.getTime() - REQUEST_COOLDOWN_MS) } }]
    }, {
      $set: {
        passwordResetTokenHash: hash,
        passwordResetExpiresAt: config.expiresAt,
        passwordResetUsedAt: null,
        passwordResetRequestedAt: now,
        passwordResetTokenVersion: version
      }
    });
    if (issued.modifiedCount !== 1) return;

    config.resetUrl.searchParams.set('token', token);
    // Respond without waiting for SMTP, so delivery latency/failure cannot reveal
    // account existence. This small app uses an in-process task, not a durable queue.
    setImmediate(async function deliverResetEmail() {
      try {
        await sendPasswordResetEmail({ to: email, resetUrl: config.resetUrl.href, expiresInMinutes: config.minutes });
      } catch {
        console.warn('[PASSWORD RESET] EMAIL_DELIVERY_FAILED');
        try {
          // A failed older delivery must never revoke a newer link.
          await User.updateOne({ _id: account._id, passwordResetTokenHash: hash }, {
            $set: { passwordResetTokenHash: null, passwordResetExpiresAt: null, passwordResetTokenVersion: null }
          });
        } catch {
          console.warn('[PASSWORD RESET] FAILED_EMAIL_TOKEN_CLEANUP_FAILED');
        }
      }
    });
  } catch {
    console.warn('[PASSWORD RESET] REQUEST_FAILED');
    // A storage/configuration failure only on an eligible account must not make
    // its HTTP response distinguishable from an unknown email's response.
  }
}

export async function verifyPasswordResetToken(token) {
  const hash = tokenHash(token);
  let account;
  try {
    account = await User.findOne(usableToken(hash, new Date())).select('_id');
  } catch {
    throw new Error('Không thể kiểm tra liên kết lúc này.');
  }
  if (!account) invalidInput(INVALID_RESET_MESSAGE);
}

export async function resetPassword(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) invalidInput('Dữ liệu không hợp lệ.');
  const hash = tokenHash(data.token);
  const { newPassword, confirmPassword } = data;
  if (typeof newPassword !== 'string' || newPassword.length < 6 || !newPassword.trim() || Buffer.byteLength(newPassword, 'utf8') > 72) {
    invalidInput('Mật khẩu mới cần ít nhất 6 ký tự và không quá 72 byte UTF-8.');
  }
  if (typeof confirmPassword !== 'string' || newPassword !== confirmPassword) invalidInput('Xác nhận mật khẩu mới không khớp.');

  let result;
  try {
    // updateOne does not run the model's pre-save hook; hash explicitly at the
    // existing cost (10), even if the submitted text starts with a bcrypt prefix.
    const password = await bcrypt.hash(newPassword, 10);
    const now = new Date(); // Recheck expiry AFTER hashing, immediately at update.
    result = await User.updateOne(usableToken(hash, now), {
      $set: {
        password,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetUsedAt: now,
        passwordResetTokenVersion: null
      },
      $inc: { tokenVersion: 1 }
    }, { runValidators: true });
  } catch {
    console.warn('[PASSWORD RESET] PASSWORD_UPDATE_FAILED');
    throw new Error('Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại sau.');
  }
  // Password and token consumption are one conditional document update. Only
  // one concurrent request can match; standalone MongoDB needs no transaction.
  if (result.modifiedCount !== 1) invalidInput(INVALID_RESET_MESSAGE);
}
