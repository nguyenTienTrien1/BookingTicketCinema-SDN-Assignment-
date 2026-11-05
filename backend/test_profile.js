import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from './src/app.js';
import User from './src/models/User.js';
import { getProfile, updateProfile, changePassword } from './src/services/profileService.js';

test('UC-5.1 Update Profile, UC-5.2 Change Password, UC-5.3 View Profile', async (t) => {
  // Only this uniquely named temporary database is written to and removed.
  const dbName = `booking_cinema_profile_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', {
    dbName, serverSelectionTimeoutMS: 5000
  });
  t.after(async () => {
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const oldPassword = randomUUID();
  const member = await User.create({ fullName: 'Profile Member', email: 'member@profile.test', password: oldPassword, status: 'Active', role: 'member' });
  const other = await User.create({ fullName: 'Other Member', email: 'other@profile.test', password: randomUUID(), status: 'Active', role: 'member' });
  const admin = await User.create({ fullName: 'Admin', email: 'admin@profile.test', password: randomUUID(), role: 'admin' });
  const employee = await User.create({ fullName: 'Employee', email: 'employee@profile.test', password: randomUUID(), role: 'employee' });
  const inactive = await User.create({ fullName: 'Inactive', email: 'inactive@profile.test', password: randomUUID(), role: 'member', status: 'Inactive' });
  function token(user, version) {
    const payload = { id: user._id };
    if (version !== undefined) payload.tokenVersion = version;
    return jwt.sign(payload, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302', { expiresIn: '5m' });
  }
  const oldToken = token(member);
  const secondToken = token(member, 0);
  async function request(method, path = '/users/me', body, session = oldToken, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (session) headers.Cookie = `token=${session}`;
    const response = await fetch(base + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }

  await t.test('authentication and member role required for all three endpoints', async () => {
    for (const [session, expected] of [[null, 401], ['invalid-token', 401], [token(inactive), 401], [token(admin), 403], [token(employee), 403]]) {
      for (const [method, path] of [['GET', '/users/me'], ['PATCH', '/users/me'], ['PATCH', '/users/me/password']]) {
        const result = await request(method, path, method === 'GET' ? undefined : {}, session);
        assert.equal(result.status, expected);
      }
    }
  });
  await t.test('view returns fresh own profile without credentials or internal fields', async () => {
    const result = await request('GET');
    assert.equal(result.status, 200);
    assert.equal(result.data.user._id, String(member._id));
    for (const key of ['password', 'verificationToken', 'verificationExpires', 'tokenVersion', 'failedLoginAttempts']) {
      assert.equal(key in result.data.user, false);
    }
  });
  await t.test('update persists allowed fields and leaves another member unchanged', async () => {
    const result = await request('PATCH', '/users/me', { fullName: '  Nguyễn Văn A  ', phone: '+84901234567', age: 22, gender: 'Male' });
    assert.equal(result.status, 200);
    assert.equal(result.data.user.fullName, 'Nguyễn Văn A');
    const saved = await User.findById(member._id);
    assert.equal(saved.phone, '+84901234567');
    assert.equal(saved.age, 22);
    assert.equal(saved.gender, 'Male');
    assert.equal((await User.findById(other._id)).fullName, 'Other Member');
    assert.equal((await request('GET')).data.user.fullName, 'Nguyễn Văn A');
  });
  await t.test('invalid data and protected fields never change the profile', async () => {
    for (const data of [
      {}, [], { fullName: '' }, { fullName: ' ' }, { fullName: 123 }, { fullName: 'a'.repeat(101) },
      { fullName: { $ne: '' } }, { phone: 'abc' }, { phone: 123 }, { phone: '123' },
      { age: -1 }, { age: 121 }, { age: 1.5 }, { age: '22' }, { gender: 'invalid' },
      { role: 'admin' }, { memberPoints: 999 }, { status: 'Active' }, { email: 'new@profile.test' },
      { password: 'newpassword' }, { tokenVersion: 10 }, { _id: other._id }
    ]) {
      assert.equal((await request('PATCH', '/users/me', data)).status, 400, JSON.stringify(data));
    }
    assert.equal((await User.findById(member._id)).fullName, 'Nguyễn Văn A');
    assert.equal((await User.findById(member._id)).role, 'member');
  });
  await t.test('optional phone and age can be cleared; age zero is valid', async () => {
    assert.equal((await request('PATCH', '/users/me', { phone: '', age: 0 })).data.user.age, 0);
    assert.equal((await request('PATCH', '/users/me', { age: null })).data.user.age, null);
  });
  await t.test('cross-origin and non-JSON writes are rejected', async () => {
    for (const path of ['/users/me', '/users/me/password']) {
      assert.equal((await request('PATCH', path, {}, oldToken, { Origin: 'https://evil.example' })).status, 403);
      assert.equal((await request('PATCH', path, {}, oldToken, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
      assert.equal((await request('PATCH', path, {}, oldToken, { 'Content-Type': 'text/plain' })).status, 415);
    }
  });
  await t.test('wrong, missing, mismatched, same and too long passwords are rejected', async () => {
    const valid = { currentPassword: oldPassword, newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!' };
    for (const body of [
      {}, { ...valid, currentPassword: 'wrong' }, { ...valid, currentPassword: {} },
      { ...valid, newPassword: '123' }, { ...valid, confirmPassword: 'different' },
      { currentPassword: oldPassword, newPassword: oldPassword, confirmPassword: oldPassword },
      { ...valid, newPassword: 'á'.repeat(40), confirmPassword: 'á'.repeat(40) },
      { ...valid, newPassword: '      ', confirmPassword: '      ' }
    ]) {
      assert.equal((await request('PATCH', '/users/me/password', body)).status, 400);
    }
    assert.equal(await (await User.findById(member._id)).comparePassword(oldPassword), true);
  });
  await t.test('missing account gives 404; database error reaches safe error response', async () => {
    const missing = new mongoose.Types.ObjectId();
    await assert.rejects(getProfile(missing), { status: 404 });
    await assert.rejects(updateProfile(missing, { fullName: 'Missing' }), { status: 404 });
    await assert.rejects(changePassword(missing, { currentPassword: 'oldpass', newPassword: 'newpass', confirmPassword: 'newpass' }), { status: 404 });
    const original = User.findById;
    let calls = 0;
    User.findById = function (...args) {
      calls += 1;
      if (calls === 2) throw new Error('Simulated database failure');
      return original.apply(this, args);
    };
    try {
      const response = await request('GET');
      assert.equal(response.status, 500);
      assert.equal(JSON.stringify(response.data).includes('Simulated'), false);
      assert.equal('stack' in response.data, false);
    } finally {
      User.findById = original;
    }
  });
  await t.test('five incorrect current passwords lock further password attempts', async () => {
    await User.findByIdAndUpdate(member._id, { failedLoginAttempts: 0, lockUntil: null });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await request('PATCH', '/users/me/password', { currentPassword: 'wrong', newPassword: 'newpassword', confirmPassword: 'newpassword' })).status, 400);
    }
    assert.equal((await request('PATCH', '/users/me/password', { currentPassword: oldPassword, newPassword: 'newpassword', confirmPassword: 'newpassword' })).status, 429);
    // Simulate expiry using only this test account in the temporary database.
    await User.findByIdAndUpdate(member._id, { lockUntil: new Date(Date.now() - 1000) });
  });
  await t.test('password change hashes input, expires cookie and revokes all previous tokens', async () => {
    // Prefix must still be treated as plaintext and hashed, never trusted as a hash.
    const newPassword = '$2b$ThisIsANewPassword123';
    const response = await request('PATCH', '/users/me/password', { currentPassword: oldPassword, newPassword, confirmPassword: newPassword });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /token=;/);
    const saved = await User.findById(member._id);
    assert.notEqual(saved.password, newPassword);
    assert.equal(await saved.comparePassword(newPassword), true);
    assert.equal(await saved.comparePassword(oldPassword), false);
    assert.equal((await request('GET')).status, 401);
    assert.equal((await request('GET', '/users/me', undefined, secondToken)).status, 401);
    assert.equal((await request('GET', '/users/me', undefined, token(other))).status, 200);
    const loginResponse = await request('POST', '/auth/login', { email: member.email, password: newPassword }, null);
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get('set-cookie').split(';')[0].substring('token='.length);
    assert.equal((await request('GET', '/users/me', undefined, cookie)).status, 200);
  });
});
