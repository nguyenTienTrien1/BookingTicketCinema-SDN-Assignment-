import User from '../models/User.js';
import { authenticate } from './auth/loginService.js';

export async function createAccount(data) {
  if (!data || typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) || typeof data.password !== 'string' || data.password.length < 6 || Buffer.byteLength(data.password, 'utf8') > 72) {
    throw Object.assign(new Error('Invalid email or password (6 characters minimum, 72 bytes maximum).'), { status: 400 });
  }
  const user = await User.create({ fullName: data.fullName, email: data.email, password: data.password, phone: data.phone, role: data.role });
  return safeUser(user);
}

export async function login(email, password) {
  const result = await authenticate(email, password, 'user');
  return result.user;
}

export async function updateStatus(id, status) {
  const user = await User.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  return user ? safeUser(user) : null;
}

export async function adjustPoints(id, points) {
  if (typeof points !== 'number' || !Number.isSafeInteger(points)) {
    throw Object.assign(new Error('Points must be an integer.'), { status: 400 });
  }
  const u = await User.findById(id);
  if (!u) return null;
  u.memberPoints = Math.max(0, u.memberPoints + Number(points));
  await u.save();
  return safeUser(u);
}

export async function applyPoints(id, points) {
  const u = await User.findById(id);
  if (!u || u.memberPoints < points) return null;
  u.memberPoints -= points;
  await u.save();
  return u;
}

function safeUser(user) {
  const result = user.toObject();
  for (const field of ['password', 'verificationToken', 'verificationExpires', 'tokenVersion', 'failedLoginAttempts', 'lockUntil']) delete result[field];
  return result;
}
