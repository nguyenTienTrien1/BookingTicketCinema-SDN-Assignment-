import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from './src/app.js';
import User from './src/models/User.js';
import Movie from './src/models/Movie.js';
import Showtime from './src/models/Showtime.js';
import Booking from './src/models/Booking.js';

test('Role permissions from RDS: Guest, Member, Employee, Admin', async (t) => {
  const dbName = 'cinema_roles_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const users = {};
  for (const role of ['member', 'employee', 'admin']) {
    users[role] = await User.create({ fullName: role, email: role + '@roles.test', password: 'password123', role, status: 'Active', phone: '0912345678' });
  }
  const employee2 = await User.create({ fullName: 'Other employee', email: 'employee2@roles.test', password: 'password123', role: 'employee' });
  function token(user) {
    return jwt.sign({ id: user.id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302');
  }
  async function request(path, user, method = 'GET', body, session) {
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
    if (user || session) headers.Cookie = 'token=' + (session || token(user));
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  }

  await t.test('public reads work for Guests; protected endpoints enforce their exact roles', async () => {
    for (const path of ['/movies', '/movies/showtimes', '/foods']) assert.equal((await request(path)).status, 200);
    const endpoints = [
      ['/users', 'admin', 'GET'], ['/users', 'admin', 'POST'],
      ['/users/' + users.member.id + '/status', 'admin', 'PATCH'],
      ['/users/' + users.member.id + '/points', 'admin', 'PATCH'],
      ['/movies/admin', 'admin', 'GET'], ['/movies', 'admin', 'POST'],
      ['/users/me', 'authenticated', 'GET'], ['/users/me', 'authenticated', 'PATCH'],
      ['/users/me/password', 'authenticated', 'PATCH'], ['/bookings', 'member', 'GET'], ['/bookings', 'member', 'POST'],
      ['/counter/members?search=member@roles.test', 'employee', 'GET'], ['/counter/bookings', 'employee', 'POST']
    ];
    for (const [path, role, method] of endpoints) {
      assert.equal((await request(path, null, method, method === 'GET' ? undefined : {})).status, 401, path);
      for (const other of ['member', 'employee', 'admin'].filter(value => role !== 'authenticated' && value !== role && !(path.startsWith('/counter') && value === 'admin'))) {
        assert.equal((await request(path, users[other], method, method === 'GET' ? undefined : {})).status, 403, other + ' ' + path);
      }
    }
  });
  await t.test('employee search reveals only permitted member data', async () => {
    const result = await request('/counter/members?search=member@roles.test', users.employee);
    assert.equal(result.status, 200);
    assert.equal(result.data.length, 1);
    assert.deepEqual(Object.keys(result.data[0]).sort(), ['_id', 'fullName', 'email', 'phone', 'memberPoints', 'status'].sort());
    assert.equal((await request('/counter/members?search=admin@roles.test', users.employee)).data.length, 0);
    assert.equal((await request('/counter/members?search=091%20234%205678', users.employee)).data.length, 1);
    assert.equal((await request('/counter/members?search=', users.employee)).status, 400);
  });
  await t.test('counter sale keeps its customer; editing stays owned and payment is shared by all staff', async () => {
    const movie = await Movie.create({ title: 'Role test', genre: ['Action'], duration: 100, description: 'Role test', releaseDate: new Date() });
    const showtime = await Showtime.create({ movie: movie._id, cinema: 'Test', room: '1', startTime: new Date(Date.now() + 3600000), price: 100000, seats: [{ number: 'A1' }, { number: 'A2' }] });
    const sale = await request('/counter/bookings', users.employee, 'POST', { memberId: users.member.id, counterEmployee: employee2.id, userId: users.admin.id, showtimeId: showtime.id, seats: ['A1'] });
    assert.equal(sale.status, 201, JSON.stringify(sale.data));
    assert.equal(sale.data.user._id, users.member.id);
    assert.equal(sale.data.counterEmployee, users.employee.id);
    assert.equal(sale.data.user.password, undefined);
    for (const [suffix, method] of [['points', 'PATCH'], ['pay', 'POST']]) {
      const path = '/counter/bookings/' + sale.data._id + '/' + suffix;
      assert.equal((await request(path, employee2, method, { points: 0, method: 'demo' })).status, suffix === 'pay' ? 200 : 404);
      assert.notEqual((await request(path, users.admin, method, { points: 0, method: 'demo' })).status, 403);
      assert.equal((await request(path, users.member, method, {})).status, 403);
      const employeeResult = await request(path, users.employee, method, { points: 0, method: 'demo' });
      assert.equal(employeeResult.status, 200);
    }
    assert.equal((await Booking.findById(sale.data._id)).status, 'paid');
    const online = await request('/bookings', users.member, 'POST', { showtimeId: showtime.id, seats: ['A2'], counterEmployee: users.employee.id });
    assert.equal(online.status, 201);
    assert.equal(online.data.counterEmployee, null);
    assert.equal((await request('/counter/bookings/' + online.data._id + '/pay', users.employee, 'POST', { method: 'demo' })).status, 200);
  });
  await t.test('admin cannot grant member-only points to staff or create members through staff provisioning', async () => {
    assert.equal((await request('/users/' + users.employee.id + '/points', users.admin, 'PATCH', { points: 10 })).status, 400);
    assert.equal((await request('/users', users.admin, 'POST', { fullName: 'Invalid', email: 'invalid@roles.test', role: 'member', password: 'password123' })).status, 400);
    assert.equal((await request('/users', users.admin, 'POST', { fullName: 'Staff', email: 'new@roles.test', role: 'employee', password: 'password123', status: 'Banned' })).status, 400);
  });
  await t.test('self-disable is denied and deactivated sessions stay revoked after reactivation', async () => {
    assert.equal((await request('/users/' + users.admin.id + '/status', users.admin, 'PATCH', { status: 'Banned' })).status, 403);
    const oldToken = token(users.employee);
    assert.equal((await request('/users/' + users.employee.id + '/status', users.admin, 'PATCH', { status: 'Deactivated' })).status, 200);
    assert.equal((await request('/auth/me', null, 'GET', undefined, oldToken)).status, 401);
    assert.equal((await request('/users/' + users.employee.id + '/status', users.admin, 'PATCH', { status: 'Active' })).status, 200);
    assert.equal((await request('/auth/me', null, 'GET', undefined, oldToken)).status, 401);
  });
});
