import User from '../models/User.js';
import { authenticate } from './auth/loginService.js';

export async function createAccount(data) {
  return User.create(data);
}

export async function login(email, password) {
  const result = await authenticate(email, password, 'user');
  return result.user;
}

export async function updateStatus(id, status) {
  return User.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
}

export async function adjustPoints(id, points) {
  const u = await User.findById(id);
  if (!u) return null;
  u.memberPoints = Math.max(0, u.memberPoints + Number(points));
  await u.save();
  return u;
}

export async function applyPoints(id, points) {
  const u = await User.findById(id);
  if (!u || u.memberPoints < points) return null;
  u.memberPoints -= points;
  await u.save();
  return u;
}
