import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';

const GENERIC_AUTH_ERROR = 'Email hoặc mật khẩu không chính xác.';
const DUMMY_HASH = '$2a$10$e8wM53zB6v0qG6/kF4g8/e6Q5dY8Z8t2b1a0.d9e8f7g6h5i4j3k2';

/**
 * Authenticates every supported account role through the shared login.
 * Follows UC-18, BR-1, BR-7, BR-8, BR-11
 */
export async function authenticate(email, password, options = {}) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
    console.log('[AUTH AUDIT] Failure: reason="MISSING_CREDENTIALS"');
    const err = new Error(GENERIC_AUTH_ERROR);
    err.status = 401;
    throw err;
  }

  // 1. Find account
  let account = await User.findOne({ email: normalizedEmail });

  if (!account) {
    // Constant-time dummy comparison to mitigate user-enumeration timing attacks
    await bcrypt.compare(password, DUMMY_HASH);
    console.log(`[AUTH AUDIT] Failure: reason="USER_NOT_FOUND", email=${normalizedEmail}`);
    const err = new Error(GENERIC_AUTH_ERROR);
    err.status = 401;
    throw err;
  }

  const now = new Date();

  // 2. Lockout check (BR-7)
  if (account.lockUntil && account.lockUntil > now) {
    console.log(`[AUTH AUDIT] Failure: reason="ACCOUNT_LOCKED", email=${normalizedEmail}, lockUntil=${account.lockUntil.toISOString()}`);
    // Non-disclosing error response per Master Prompt & BR-7
    const err = new Error(GENERIC_AUTH_ERROR);
    err.status = 401;
    throw err;
  }

  // If previous lock has expired, reset counter
  if (account.lockUntil && account.lockUntil <= now) {
    await User.updateOne({ _id: account._id, lockUntil: { $lte: now } }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
    console.log(`[AUTH AUDIT] Lockout period expired; counter reset for ${normalizedEmail}`);
  }

  // 3. Status check (BR-8 & UC-18 Exception E2)
  const isStatusActive = account.status === 'Active' || account.status === 'active';
  if (!isStatusActive) {
    console.log(`[AUTH AUDIT] Failure: reason="ACCOUNT_NOT_ACTIVE", status=${account.status}, email=${normalizedEmail}`);
    const err = new Error(GENERIC_AUTH_ERROR);
    err.status = 401;
    throw err;
  }

  // A single login accepts every supported account role. API authorization stays separate.
  if (!['member', 'employee', 'admin'].includes(account.role)) {
    throw Object.assign(new Error(GENERIC_AUTH_ERROR), { status: 401 });
  }

  // 5. Password verification using bcrypt (BR-1)
  if (!account.password) await bcrypt.compare(password, DUMMY_HASH);
  const isMatch = await account.comparePassword(password);

  if (!isMatch) {
    // Record failed attempt (BR-7: 5 consecutive failures = 15-minute lock)
    const failed = await User.findByIdAndUpdate(account._id, { $inc: { failedLoginAttempts: 1 } }, { new: true });
    if (failed && failed.failedLoginAttempts >= 5) {
      await User.updateOne({ _id: account._id, failedLoginAttempts: { $gte: 5 } }, { $set: { lockUntil: new Date(Date.now() + 15 * 60 * 1000) } });
    }
    console.log(`[AUTH AUDIT] Failure: reason="INVALID_PASSWORD", email=${normalizedEmail}, failedAttempts=${failed?.failedLoginAttempts}`);
    const err = new Error(GENERIC_AUTH_ERROR);
    err.status = 401;
    throw err;
  }

  // 6. Success: Reset failure count and update last login timestamp
  const authenticated = await User.findOneAndUpdate(
    { _id: account._id, password: account.password, status: account.status, role: account.role, tokenVersion: { $in: [account.tokenVersion || 0, null] },
      $or: [{ lockUntil: null }, { lockUntil: { $lte: now } }] },
    { $set: { failedLoginAttempts: 0, lockUntil: null, lastLogin: new Date() } },
    { new: true }
  );
  if (!authenticated) throw Object.assign(new Error(GENERIC_AUTH_ERROR), { status: 401 });
  account = authenticated;

  // Internal security actions need the exact verified hash (including legacy
  // migration) for a conditional write; controllers never request this mode.
  if (options.reauthentication === true) return account;
  return createSession(account);
}

// Shared by local and Google authentication; Google tokens never become app sessions.
export function createSession(account) {
  // 7. Generate JWT
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';

  const token = jwt.sign(
    {
      id: account._id,
      email: account.email,
      role: account.role,
      fullName: account.fullName,
      tokenVersion: account.tokenVersion || 0
    },
    secret,
    { expiresIn }
  );

  console.log(`[AUTH AUDIT] Success: login successful for user=${account._id}, role=${account.role}`);

  // Safe user representation (never return password hash)
  const safeUser = {
    _id: account._id,
    fullName: account.fullName,
    email: account.email,
    role: account.role,
    phone: account.phone || '',
    gender: account.gender || 'Other',
    age: account.age,
    isVIP: account.isVIP || false,
    memberPoints: account.memberPoints || 0,
    status: account.status,
    lastLogin: account.lastLogin
  };

  return { user: safeUser, token };
}

/**
 * Verifies JWT token and retrieves active account
 */
export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const account = await User.findById(decoded.id);
    if (!account) return null;

    // Changing a password invalidates every previously issued session.
    if ((decoded.tokenVersion || 0) !== (account.tokenVersion || 0)) return null;

    const isStatusActive = account.status === 'Active' || account.status === 'active';
    if (!isStatusActive) return null;

    return {
      _id: account._id,
      fullName: account.fullName,
      email: account.email,
      role: account.role,
      phone: account.phone || '',
      gender: account.gender || 'Other',
      age: account.age,
      isVIP: account.isVIP || false,
      memberPoints: account.memberPoints || 0,
      status: account.status,
      lastLogin: account.lastLogin
    };
  } catch (error) {
    return null;
  }
}


export function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be configured.');
  return 'supersecret_cinema_jwt_key_2026_sdn302';
}
