// Explicit legacy/custom step coverage; the configured application default is 100.
process.env.POINT_REDEEM_STEP='1';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import app from './src/app.js';
import User from './src/models/User.js';
import Movie from './src/models/Movie.js';
import Showtime from './src/models/Showtime.js';
import Booking from './src/models/Booking.js';

test('API authorization and booking regression', async (t) => {
  const dbName = 'cinema_regression_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const admin = await User.create({ fullName: 'Admin', email: 'admin@test.local', password: 'password123', role: 'admin' });
  const member = await User.create({ fullName: 'Member', email: 'member@test.local', password: 'password123', status: 'Active' });
  const other = await User.create({ fullName: 'Other', email: 'other@test.local', password: 'password123', status: 'Active' });
  async function request(path, user, method = 'GET', body) {
    // Fixtures use the explicit development-only simulator, not a provider success claim.
    if (path.endsWith('/pay') && body?.method === 'demo' && path.startsWith('/counter')) {
      const id = path.split('/').at(-2); const order = await Booking.findById(id);
      body = { ...body, receivedAmount: order?.total || 0 };
    }
    if (path.endsWith('/status') && body && body.expectedStatus === undefined) {
      const id = path.split('/').at(-2);
      if (mongoose.isObjectIdOrHexString(id)) { const account = await User.findById(id); body = { ...body, expectedStatus: account?.status || 'Active' }; }
    }
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Cookie = 'token=' + jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302');
    const res = await fetch('http://127.0.0.1:' + server.address().port + '/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie') };
  }
  await t.test('registration requires activation; resend replaces token and activated member can sign in', async () => {
    const previousTransport = nodemailer.createTransport;
    const keys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'NODE_ENV'];
    const previousEnv = keys.map(key => process.env[key]);
    let delivered = 0;
    nodemailer.createTransport = () => ({ sendMail: async () => {
      delivered++;
      return { messageId: 'local-test' };
    } });
    process.env.SMTP_HOST = 'smtp.test.local';
    process.env.SMTP_USER = 'test';
    process.env.SMTP_PASS = 'test';
    process.env.NODE_ENV = 'test';
    try {
      const credentials = { email: 'registered@test.local', password: 'password123' };
      const registered = await request('/auth/register', null, 'POST', { ...credentials, fullName: 'New Member', role: 'admin', status: 'Active', memberPoints: 999 });
      assert.equal(registered.status, 201);
      assert.equal(registered.data.user.status, 'Pending Verification');
      assert.equal(registered.data.user.role, 'member');
      assert.ok(registered.data.verificationLink);
      assert.equal((await request('/auth/login', null, 'POST', credentials)).status, 401);
      const resent = await request('/auth/resend-verification', null, 'POST', { email: credentials.email });
      assert.equal(resent.status, 200);
      assert.notEqual(resent.data.verificationToken, registered.data.verificationToken);
      assert.equal((await request('/auth/verify-email?token=' + registered.data.verificationToken)).status, 400);
      const verified = await request('/auth/verify-email?token=' + resent.data.verificationToken);
      assert.equal(verified.status, 200);
      assert.equal((await request('/auth/login', null, 'POST', credentials)).status, 200);
      assert.equal((await request('/auth/verify-email?token=' + resent.data.verificationToken)).status, 400);
      process.env.NODE_ENV = 'production';
      const production = await request('/auth/register', null, 'POST', { fullName: 'Production', email: 'production@test.local', password: 'password123' });
      assert.equal(production.status, 201);
      assert.equal(production.data.verificationLink, undefined);
      const productionResend = await request('/auth/resend-verification', null, 'POST', { email: 'production@test.local' });
      assert.equal(productionResend.status, 200);
      assert.equal(productionResend.data.verificationToken, undefined);
      assert.equal(delivered, 4);
    } finally {
      nodemailer.createTransport = previousTransport;
      keys.forEach((key, i) => {
        if (previousEnv[i] === undefined) delete process.env[key];
        else process.env[key] = previousEnv[i];
      });
    }
  });
  await t.test('one login authenticates every role, preserves HttpOnly sessions and ignores client role claims', async () => {
    const employee = await User.create({ fullName: 'Employee', email: 'employee@test.local', password: 'password123', role: 'employee' });
    for (const [user, portal] of [[member, '/auth/login'], [admin, '/auth/login'], [employee, '/auth/login']]) {
      const result = await request(portal, null, 'POST', { email: '  ' + user.email.toUpperCase() + '  ', password: 'password123', role: 'admin', portalType: 'admin' });
      assert.equal(result.status, 200);
      assert.equal(result.data.user._id, user.id);
      assert.equal(result.data.user.password, undefined);
      assert.match(result.cookie, /HttpOnly/);
      assert.match(result.cookie, /SameSite=Lax/i);
      const cookie = result.cookie.split(';')[0];
      const restored = await fetch('http://127.0.0.1:' + server.address().port + '/api/auth/me', { headers: { Cookie: cookie } });
      assert.equal(restored.status, 200);
      assert.equal((await restored.json()).user.role, user.role);
    }
    assert.equal((await request('/auth/login', null, 'POST', { email: admin.email, password: 'wrong-password' })).status, 401);
    assert.equal((await request('/auth/admin/login', null, 'POST', { email: member.email, password: 'password123' })).status, 200);
    assert.equal((await request('/auth/login', null, 'POST', { email: member.email, password: 'wrong-password', role: 'admin' })).status, 401);
    const loggedOut = await request('/auth/logout', member, 'POST', {});
    assert.equal(loggedOut.status, 200);
    assert.match(loggedOut.cookie, /token=;/);
    assert.equal((await request('/auth/me')).status, 401);
  });
  await t.test('five simultaneous wrong passwords lock account; expired lock permits correct login', async () => {
    const locked = await User.create({ fullName: 'Locked', email: 'locked@test.local', password: 'password123', status: 'Active' });
    const wrong = await Promise.all(Array.from({ length: 5 }, () => request('/auth/login', null, 'POST', { email: locked.email, password: 'wrong-password' })));
    assert.ok(wrong.every(result => result.status === 401));
    const persisted = await User.findById(locked.id);
    assert.equal(persisted.failedLoginAttempts, 5);
    assert.ok(persisted.lockUntil > new Date());
    assert.equal((await request('/auth/login', null, 'POST', { email: locked.email, password: 'password123' })).status, 401);
    await User.updateOne({ _id: locked.id }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
    assert.equal((await request('/auth/login', null, 'POST', { email: locked.email, password: 'password123' })).status, 200);
    assert.equal((await User.findById(locked.id)).failedLoginAttempts, 0);
  });
  await t.test('invalid, expired and revoked tokens fail; database role overrides token claims', async () => {
    const origin = 'http://127.0.0.1:' + server.address().port + '/api';
    const secret = process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302';
    for (const token of ['invalid', jwt.sign({ id: member.id }, secret, { expiresIn: -1 }), jwt.sign({ id: member.id, tokenVersion: 99 }, secret)]) {
      assert.equal((await fetch(origin + '/auth/me', { headers: { Cookie: 'token=' + token } })).status, 401);
    }
    const forgedRole = jwt.sign({ id: member.id, role: 'admin' }, secret);
    assert.equal((await fetch(origin + '/admin/dashboard', { headers: { Cookie: 'token=' + forgedRole } })).status, 403);
    await User.updateOne({ _id: other.id }, { $set: { status: 'Banned' } });
    assert.equal((await request('/auth/me', other)).status, 401);
    await User.updateOne({ _id: other.id }, { $set: { status: 'Active' } });
  });
  await t.test('passwords with bcrypt prefixes are hashed, exact and never silently truncated', async () => {
    const password = '$2b$example-password';
    const prefixed = await User.create({ fullName: 'Prefix', email: 'prefix@test.local', password, status: 'Active' });
    assert.notEqual(prefixed.password, password);
    assert.equal((await request('/auth/login', null, 'POST', { email: prefixed.email, password })).status, 200);
    assert.equal((await request('/auth/login', null, 'POST', { email: prefixed.email, password: password + 'wrong' })).status, 401);
    assert.equal((await request('/auth/login', null, 'POST', { email: member.email, password: 'x'.repeat(73) })).status, 401);
  });
  await t.test('legacy account login migrates plaintext and missing session version without changing the password', async () => {
    const legacy = await User.create({ fullName: 'Legacy', email: 'legacy@test.local', password: 'legacy-password', status: 'Active' });
    await User.collection.updateOne({ _id: legacy._id }, { $set: { password: 'legacy-password' }, $unset: { tokenVersion: '' } });
    assert.equal((await request('/auth/login', null, 'POST', { email: legacy.email, password: 'legacy-password' })).status, 200);
    const migrated = await User.findById(legacy.id);
    assert.notEqual(migrated.password, 'legacy-password');
    assert.match(migrated.password, /^\$2[ab]\$/);
    assert.equal((await request('/auth/login', null, 'POST', { email: legacy.email, password: 'legacy-password' })).status, 200);
  });
  await t.test('anonymous and members cannot manage accounts', async () => {
    for (const path of ['/users', '/bookings']) assert.equal((await request(path)).status, 401);
    assert.equal((await request('/users', member)).status, 403);
    assert.equal((await request('/users/' + other.id + '/points', member, 'PATCH', { points: 100 })).status, 403);
  });
  await t.test('admin responses omit credentials and invalid points are rejected', async () => {
    assert.equal((await request('/users', admin, 'POST', { fullName: 'Staff', email: 'staff@test.local', password: 'password123', role: 'employee', memberPoints: 999 })).status, 400);
    // Exercise missing SMTP without contacting any configured external inbox.
    const saved = Object.fromEntries(['SMTP_HOST','SMTP_USER','SMTP_PASS','GMAIL_USER','GMAIL_APP_PASS'].map(key => [key,process.env[key]]));
    for (const key of Object.keys(saved)) delete process.env[key];
    let created;
    try { created = await request('/users', admin, 'POST', { fullName: 'Staff', email: 'staff@test.local', role: 'employee' }); }
    finally { for (const [key,value] of Object.entries(saved)) if(value === undefined) delete process.env[key]; else process.env[key]=value; }
    assert.equal(created.status, 201);
    assert.equal(created.data.password, undefined);
    assert.equal(created.data.user.status, 'Pending Activation');
    assert.equal(created.data.emailSent, false);
    assert.equal((await User.findById(created.data.user._id)).memberPoints, 0);
    assert.equal((await request('/users/' + member.id + '/points', admin, 'PATCH', { points: 'bad' })).status, 400);
    assert.equal((await request('/users/bad/status', admin, 'PATCH', { status: 'Active' })).status, 400);
  });
  await t.test('malformed credentials and booking data return client errors', async () => {
    assert.equal((await request('/auth/login', null, 'POST', { email: {}, password: {} })).status, 401);
    assert.equal((await request('/auth/resend-verification', null, 'POST', { email: {} })).status, 400);
    assert.equal((await request('/bookings', member, 'POST', { showtimeId: 'bad', seats: ['A1'], foodItems: {} })).status, 400);
  });
  await t.test('booking uses session identity, isolates history and validates payment', async () => {
    const movie = await Movie.create({ title: 'Regression', duration: 100, genre: 'Action', releaseDate: new Date(), description: 'Test' });
    const showtime = await Showtime.create({ movie: movie._id, startTime: new Date(Date.now() + 3600000), room: '1', cinema: 'Test Cinema', price: 100000, seats: [{ number: 'A1', status: 'available' }] });
    const created = await request('/bookings', member, 'POST', { userId: other.id, showtimeId: showtime.id, seats: ['A1'] });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.equal(created.data.user._id, member.id);
    assert.equal(created.data.user.password, undefined);
    assert.equal((await request('/bookings?userId=' + member.id, other)).data.length, 0);
    assert.equal((await request('/bookings/' + created.data._id + '/pay', other, 'POST', { userId: member.id })).status, 404);
    assert.equal((await request('/bookings/' + created.data._id + '/pay', member, 'POST', { method: 'invalid' })).status, 400);
    assert.equal((await Booking.findById(created.data._id)).status, 'pending');
    assert.equal((await request('/bookings/' + created.data._id + '/pay', member, 'POST', { method: 'demo' })).status, 200);
  });
});
