// Explicit legacy/custom step coverage; the configured application default is 100.
process.env.POINT_REDEEM_STEP='1';
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

test('Counter sales and justified member point adjustments', async (t) => {
  const dbName = 'cinema_counter_points_' + randomUUID().replaceAll('-', '');
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
  async function account(role, balance = 0) {
    return User.create({ fullName: role, role, email: randomUUID() + '@points.test', password: 'password123', status: 'Active', memberPoints: balance });
  }
  const admin = await account('admin');
  const employee = await account('employee');
  const member = await account('member', 100);
  const movie = await Movie.create({ title: 'Counter points', genre: ['Action'], duration: 100, description: 'Test', releaseDate: new Date() });
  async function request(path, actor, method = 'GET', body) {
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
    if (actor) headers.Cookie = 'token=' + jwt.sign({ id: actor.id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302');
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  async function showtime() {
    return Showtime.create({ movie: movie._id, cinema: 'Counter', room: '1', startTime: new Date(Date.now() + 3600000), price: 100000, seats: [{ number: 'A1' }] });
  }
  async function sale(actor, customer, points = 0) {
    const show = await showtime();
    const result = await request('/counter/bookings', actor, 'POST', { memberId: customer.id, showtimeId: show.id, seats: ['A1'], points });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return { booking: result.data, show };
  }
  function correction(points, expectedBalance) {
    return { points, expectedBalance, reason: 'Correction after review', requestId: randomUUID() };
  }

  await t.test('Admin and Employee sell guest tickets without creating accounts or storing customer identity', async () => {
    const userCount = await User.countDocuments();
    for (const actor of [admin, employee]) {
      const show = await showtime();
      const created = await request('/counter/bookings', actor, 'POST', {
        customerType: 'guest', memberId: member.id, userId: actor.id,
        fullName: 'Must not be saved', email: 'private@guest.test', phone: '0900000000',
        showtimeId: show.id, seats: ['A1']
      });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      assert.equal(created.data.user, null);
      assert.equal(created.data.counterEmployee, actor.id);
      assert.equal(created.data.pointsUsed, 0);
      const persisted = await Booking.findById(created.data._id).lean();
      assert.equal(persisted.user, null);
      assert.equal(persisted.email, undefined);
      assert.equal(persisted.phone, undefined);
      const paid = await request('/counter/bookings/' + created.data._id + '/pay', actor, 'POST', { method: 'demo' });
      assert.equal(paid.status, 200);
      assert.equal(paid.data.user, null);
      assert.equal(paid.data.status, 'paid');
      assert.equal((await User.findById(actor.id)).memberPoints, 0);
    }
    assert.equal(await User.countDocuments(), userCount);
    assert.equal((await User.findById(member.id)).memberPoints, 100);
  });
  await t.test('guest sale cannot redeem points and stays protected from Members and other employees', async () => {
    const show = await showtime();
    const invalid = await request('/counter/bookings', employee, 'POST', { customerType: 'guest', showtimeId: show.id, seats: ['A1'], points: 1 });
    assert.equal(invalid.status, 400);
    assert.equal((await Showtime.findById(show.id)).seats[0].status, 'available');
    const created = await request('/counter/bookings', employee, 'POST', { showtimeId: show.id, seats: ['A1'] });
    assert.equal(created.status, 201);
    const path = '/counter/bookings/' + created.data._id;
    assert.equal((await request(path + '/points', employee, 'PATCH', { points: 1 })).status, 400);
    const otherEmployee = await account('employee');
    assert.equal((await request(path + '/pay', otherEmployee, 'POST', { method: 'demo' })).status, 404);
    assert.equal((await request(path + '/pay', member, 'POST', { method: 'demo' })).status, 403);
    assert.equal((await request('/bookings/' + created.data._id + '/pay', member, 'POST', { method: 'demo' })).status, 404);
    assert.equal((await request(path + '/pay', admin, 'POST', { method: 'demo' })).status, 200);
  });
  await t.test('invalid Member lookup is not silently changed into a guest sale', async () => {
    const show = await showtime();
    const result = await request('/counter/bookings', admin, 'POST', { customerType: 'member', showtimeId: show.id, seats: ['A1'] });
    assert.equal(result.status, 400);
    assert.equal(await Booking.countDocuments({ showtime: show.id }), 0);
  });

  await t.test('online member chooses, changes and removes redemption from their own order', async () => {
    const customer = await account('member', 50);
    const other = await account('member', 100);
    const show = await showtime();
    const created = await request('/bookings', customer, 'POST', {
      userId: other.id, counterEmployee: admin.id, showtimeId: show.id, seats: ['A1'], points: 20
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.user._id, customer.id);
    assert.equal(created.data.counterEmployee, null);
    assert.equal(created.data.discount, 20000);
    assert.equal(created.data.total, 80000);
    assert.equal((await User.findById(customer.id)).memberPoints, 50);
    const path = '/bookings/' + created.data._id;
    assert.equal((await request(path + '/points', other, 'PATCH', { userId: customer.id, points: 5 })).status, 404);
    assert.equal((await request(path + '/points', customer, 'PATCH', { points: 10 })).data.total, 90000);
    const removed = await request(path + '/points', customer, 'PATCH', { points: 0 });
    assert.equal(removed.status, 200);
    assert.equal(removed.data.discount, 0);
    assert.equal(removed.data.total, 100000);
    assert.equal((await request(path + '/points', customer, 'PATCH', { points: 20 })).status, 200);
    const paid = await request(path + '/pay', customer, 'POST', { method: 'demo', userId: other.id });
    assert.equal(paid.status, 200);
    assert.equal(paid.data.user.memberPoints, 30);
    assert.equal((await request('/users/me', customer)).data.user.memberPoints, 30);
    assert.equal((await User.findById(other.id)).memberPoints, 100);
    assert.equal((await request(path + '/points', customer, 'PATCH', { points: 0 })).status, 410);
  });
  await t.test('online full-price redemption produces zero total without earning or deducting twice', async () => {
    const customer = await account('member', 200);
    const show = await showtime();
    const created = await request('/bookings', customer, 'POST', { showtimeId: show.id, seats: ['A1'], points: 100 });
    assert.equal(created.status, 201);
    assert.equal(created.data.total, 0);
    const path = '/bookings/' + created.data._id + '/pay';
    const results = await Promise.all([request(path, customer, 'POST', { method: 'demo' }), request(path, customer, 'POST', { method: 'demo' })]);
    assert.ok(results.some(result => result.status === 200));
    assert.ok(results.every(result => [200, 409].includes(result.status)));
    assert.equal((await request(path, customer, 'POST', { method: 'demo' })).status, 200);
    assert.equal((await request('/users/me', customer)).data.user.memberPoints, 100);
  });
  await t.test('online checkout can refresh an adjusted balance and reduce redemption before retrying', async () => {
    const customer = await account('member', 50);
    const show = await showtime();
    const created = await request('/bookings', customer, 'POST', { showtimeId: show.id, seats: ['A1'], points: 20 });
    assert.equal(created.status, 201);
    assert.equal((await request('/users/' + customer.id + '/points', admin, 'PATCH', correction(-40, 50))).status, 200);
    const path = '/bookings/' + created.data._id;
    assert.equal((await request(path + '/pay', customer, 'POST', { method: 'demo' })).status, 409);
    assert.equal((await request('/users/me', customer)).data.user.memberPoints, 10);
    assert.equal((await request(path + '/points', customer, 'PATCH', { points: 10 })).data.total, 90000);
    assert.equal((await request(path + '/pay', customer, 'POST', { method: 'demo' })).status, 200);
    assert.equal((await request('/users/me', customer)).data.user.memberPoints, 0);
  });
  await t.test('online invalid redemption never claims seats or changes member balances', async () => {
    const customer = await account('member', 200);
    for (const points of [-1, 0.5, 101]) {
      const show = await showtime();
      const result = await request('/bookings', customer, 'POST', { showtimeId: show.id, seats: ['A1'], points });
      assert.equal(result.status, 400);
      assert.equal((await Showtime.findById(show.id)).seats[0].status, 'available');
      assert.equal(await Booking.countDocuments({ showtime: show.id }), 0);
    }
    assert.equal((await User.findById(customer.id)).memberPoints, 200);
  });

  await t.test('Admin and Employee create customer sales; staff balances are never redeemed', async () => {
    for (const actor of [admin, employee]) {
      const customer = await account('member', 50);
      const { booking } = await sale(actor, customer, 20);
      assert.equal(booking.user._id, customer.id);
      assert.equal(booking.counterEmployee, actor.id);
      assert.equal(booking.total, 80000);
      assert.equal((await User.findById(customer.id)).memberPoints, 50);
      const paid = await request('/counter/bookings/' + booking._id + '/pay', actor, 'POST', { method: 'demo', userId: actor.id });
      assert.equal(paid.status, 200);
      assert.equal((await User.findById(customer.id)).memberPoints, 30);
      assert.equal((await User.findById(actor.id)).memberPoints, 0);
    }
  });
  await t.test('invalid initial redemption leaves seats available and creates no booking', async () => {
    const customer = await account('member', 10);
    for (const points of [-1, 0.5, 11, 101]) {
      const show = await showtime();
      const result = await request('/counter/bookings', admin, 'POST', { memberId: customer.id, showtimeId: show.id, seats: ['A1'], points });
      assert.ok([400, 409].includes(result.status));
      assert.equal((await Showtime.findById(show.id)).seats[0].status, 'available');
      assert.equal(await Booking.countDocuments({ showtime: show.id }), 0);
    }
  });
  await t.test('parallel payments and retries deduct the selected points once', async () => {
    const customer = await account('member', 50);
    const { booking } = await sale(employee, customer, 20);
    const results = await Promise.all(Array.from({ length: 4 }, () => request('/counter/bookings/' + booking._id + '/pay', employee, 'POST', { method: 'demo' })));
    assert.ok(results.some(result => result.status === 200));
    assert.ok(results.every(result => [200, 409].includes(result.status)));
    assert.equal((await User.findById(customer.id)).memberPoints, 30);
    assert.equal((await request('/counter/bookings/' + booking._id + '/pay', admin, 'POST', { method: 'demo' })).status, 200);
    assert.equal((await User.findById(customer.id)).memberPoints, 30);
  });
  await t.test('redemption is frozen during payment and insufficient current balance blocks payment', async () => {
    const customer = await account('member', 50);
    const { booking } = await sale(employee, customer, 20);
    await Booking.updateOne({ _id: booking._id }, { $set: { paymentProcessing: true } });
    assert.equal((await request('/counter/bookings/' + booking._id + '/points', admin, 'PATCH', { points: 0 })).status, 409);
    await Booking.updateOne({ _id: booking._id }, { $set: { paymentProcessing: false } });
    assert.equal((await request('/users/' + customer.id + '/points', admin, 'PATCH', correction(-40, 50))).status, 200);
    assert.equal((await request('/counter/bookings/' + booking._id + '/pay', employee, 'POST', { method: 'demo' })).status, 409);
    assert.equal((await User.findById(customer.id)).memberPoints, 10);
    assert.equal((await Booking.findById(booking._id)).status, 'pending');
    assert.equal((await request('/counter/bookings/' + booking._id + '/points', employee, 'PATCH', { points: 0 })).status, 200);
    assert.equal((await request('/counter/bookings/' + booking._id + '/pay', employee, 'POST', { method: 'demo' })).status, 200);
  });
  await t.test('seat update failure refunds points and unlocks the sale for retry', async () => {
    const customer = await account('member', 50);
    const { booking } = await sale(admin, customer, 20);
    const original = Showtime.updateOne;
    Showtime.updateOne = async () => { throw new Error('Simulated seat failure'); };
    try {
      assert.equal((await request('/counter/bookings/' + booking._id + '/pay', admin, 'POST', { method: 'demo' })).status, 500);
    } finally { Showtime.updateOne = original; }
    assert.equal((await User.findById(customer.id)).memberPoints, 50);
    assert.equal((await Booking.findById(booking._id)).paymentProcessing, false);
    assert.equal((await request('/counter/bookings/' + booking._id + '/pay', admin, 'POST', { method: 'demo' })).status, 200);
    assert.equal((await User.findById(customer.id)).memberPoints, 30);
  });
  await t.test('finalization failure restores seat hold and refunds deducted points', async () => {
    const customer = await account('member', 50);
    const { booking, show } = await sale(employee, customer, 20);
    const original = Booking.prototype.save;
    Booking.prototype.save = function(options) { if(this.status==='paid')throw new Error('Simulated booking failure');return original.call(this,options); };
    try {
      assert.equal((await request('/counter/bookings/' + booking._id + '/pay', employee, 'POST', { method: 'demo' })).status, 500);
    } finally { Booking.prototype.save = original; }
    assert.equal((await User.findById(customer.id)).memberPoints, 50);
    assert.equal((await Showtime.findById(show.id)).seats[0].status, 'held');
    assert.equal((await Booking.findById(booking._id)).paymentProcessing, false);
  });
  await t.test('manual correction is Admin-only, justified and atomic with its history', async () => {
    const body = correction(25, 100);
    const path = '/users/' + member.id + '/points';
    assert.equal((await request(path, employee, 'PATCH', body)).status, 403);
    assert.equal((await request(path, member, 'PATCH', body)).status, 403);
    const result = await request(path, admin, 'PATCH', body);
    assert.equal(result.status, 200);
    assert.equal(result.data.memberPoints, 125);
    assert.equal(result.data.pointAdjustments, undefined);
    const history = await request('/users/' + member.id + '/points-history', admin);
    assert.equal(history.status, 200);
    assert.equal(history.data.entries[0].before, 100);
    assert.equal(history.data.entries[0].after, 125);
    assert.equal(history.data.entries[0].admin._id, admin.id);
    assert.equal(history.data.entries[0].reason, body.reason);
    assert.equal((await request('/users/' + member.id + '/points-history', employee)).status, 403);
  });
  await t.test('retry after a lost client response returns the same tickets and balance', async () => {
    const customer=await account('member',50);const {booking}=await sale(admin,customer,20);
    const first=await request('/counter/bookings/'+booking._id+'/pay',admin,'POST',{method:'demo'});
    const retry=await request('/counter/bookings/'+booking._id+'/pay',admin,'POST',{method:'demo'});
    assert.equal(first.status,200);assert.equal(retry.status,200);assert.equal(first.data.tickets[0].code,retry.data.tickets[0].code);assert.equal((await User.findById(customer.id)).memberPoints,30);
  });
  await t.test('expired holds and inactive members cannot consume points', async () => {
    const customer = await account('member', 50);
    const { booking } = await sale(employee, customer, 20);
    await Booking.updateOne({ _id: booking._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await request('/counter/bookings/' + booking._id + '/pay', employee, 'POST', { method: 'demo' })).status, 410);
    assert.equal((await User.findById(customer.id)).memberPoints, 50);
    const activeSale = await sale(admin, customer, 20);
    await User.updateOne({ _id: customer.id }, { $set: { status: 'Banned' } });
    assert.equal((await request('/counter/bookings/' + activeSale.booking._id + '/pay', admin, 'POST', { method: 'demo' })).status, 409);
    assert.equal((await User.findById(customer.id)).memberPoints, 50);
  });
  await t.test('manual adjustments reject zero, fractions, missing reason, staff and negative balance', async () => {
    const customer = await account('member', 10);
    const path = '/users/' + customer.id + '/points';
    for (const body of [correction(0, 10), correction(0.5, 10), correction(-11, 10), { ...correction(5, 10), reason: '' }]) {
      assert.equal((await request(path, admin, 'PATCH', body)).status, 400);
    }
    assert.equal((await request('/users/' + employee.id + '/points', admin, 'PATCH', correction(5, 0))).status, 400);
    assert.equal((await User.findById(customer.id)).memberPoints, 10);
    assert.equal((await User.findById(customer.id).select('+pointAdjustments')).pointAdjustments.length, 0);
  });
  await t.test('duplicate corrections are applied once; stale balance and changed payload are rejected', async () => {
    const customer = await account('member', 100);
    const path = '/users/' + customer.id + '/points';
    const body = correction(25, 100);
    const replies = await Promise.all([request(path, admin, 'PATCH', body), request(path, admin, 'PATCH', body)]);
    assert.ok(replies.every(result => result.status === 200));
    assert.equal((await User.findById(customer.id)).memberPoints, 125);
    assert.equal((await User.findById(customer.id).select('+pointAdjustments')).pointAdjustments.length, 1);
    assert.equal((await request(path, admin, 'PATCH', { ...body, points: 30 })).status, 409);
    assert.equal((await request(path, admin, 'PATCH', correction(-5, 100))).status, 409);
    assert.equal((await request(path, admin, 'PATCH', correction(-5, 125))).data.memberPoints, 120);
  });
});
