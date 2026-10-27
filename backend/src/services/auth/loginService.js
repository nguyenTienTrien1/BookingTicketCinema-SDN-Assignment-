import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';

const GENERIC_AUTH_ERROR = 'Email hoặc mật khẩu không chính xác.';
const DUMMY_HASH = '$2a$10$e8wM53zB6v0qG6/kF4g8/e6Q5dY8Z8t2b1a0.d9e8f7g6h5i4j3k2';

/**
 * Authenticates user for Member/Employee portal or Admin portal
 * Follows UC-18, BR-1, BR-7, BR-8, BR-11
 */
export async function authenticate(email, password, portalType = 'user') {
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    console.log('[AUTH AUDIT] Failure: reason="MISSING_CREDENTIALS"');
    const err = new Error(GENERIC_AUTH_ERROR);
    err.status = 401;
    throw err;
  }

  // 1. Find account
  const account = await User.findOne({ email: normalizedEmail });

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
    account.failedLoginAttempts = 0;
    account.lockUntil = null;
    await account.save();
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

  // 4. Role authorization check (BR-11)
  if (portalType === 'admin') {
    // Admin and Employee share the administration/staff portal (/admin/login)
    if (account.role !== 'admin' && account.role !== 'employee') {
      console.log(`[AUTH AUDIT] Failure: reason="ROLE_MISMATCH", required=admin/employee, actual=${account.role}, email=${normalizedEmail}`);
      const err = new Error(GENERIC_AUTH_ERROR);
      err.status = 401;
      throw err;
    }
  } else {
    // Member portal (/login)
    if (account.role !== 'member') {
      console.log(`[AUTH AUDIT] Failure: reason="ROLE_MISMATCH", required=member, actual=${account.role}, email=${normalizedEmail}`);
      const err = new Error(GENERIC_AUTH_ERROR);
      err.status = 401;
      throw err;
    }
  }

  // 5. Password verification using bcrypt (BR-1)
  const isMatch = await account.comparePassword(password);

  if (!isMatch) {
    // Record failed attempt (BR-7: 5 consecutive failures = 15-minute lock)
    account.failedLoginAttempts = (account.failedLoginAttempts || 0) + 1;
    if (account.failedLoginAttempts >= 5) {
      account.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      console.log(`[AUTH AUDIT] Lockout triggered: email=${normalizedEmail}, attempts=${account.failedLoginAttempts}, lockUntil=${account.lockUntil.toISOString()}`);
    }
    await account.save();

    console.log(`[AUTH AUDIT] Failure: reason="INVALID_PASSWORD", email=${normalizedEmail}, failedAttempts=${account.failedLoginAttempts}`);
    const err = new Error(GENERIC_AUTH_ERROR);
    err.status = 401;
    throw err;
  }

  // 6. Success: Reset failure count and update last login timestamp
  account.failedLoginAttempts = 0;
  account.lockUntil = null;
  account.lastLogin = new Date();
  await account.save();

  // 7. Generate JWT
  const secret = process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302';
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';

  const token = jwt.sign(
    {
      id: account._id,
      email: account.email,
      role: account.role,
      fullName: account.fullName
    },
    secret,
    { expiresIn }
  );

  console.log(`[AUTH AUDIT] Success: login successful for email=${normalizedEmail}, role=${account.role}`);

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
    const secret = process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302';
    const decoded = jwt.verify(token, secret);
    const account = await User.findById(decoded.id);
    if (!account) return null;

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

