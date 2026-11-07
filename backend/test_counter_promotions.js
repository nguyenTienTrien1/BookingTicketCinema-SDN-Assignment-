import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from './src/app.js';
import User from './src/models/User.js';
import Movie from './src/models/Movie.js';
import Showtime from './src/models/Showtime.js';
import Food from './src/models/Food.js';
import Promotion from './src/models/Promotion.js';
import Booking from './src/models/Booking.js';
import PaymentAttempt from './src/models/PaymentAttempt.js';

test('UC9.2 counter food and promotion snapshots with atomic redemption', async t => {
  process.env.POINT_REDEEM_STEP = '100';
  const dbName = 'cinema_counter_promotions_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => { assert.equal(mongoose.connection.name, dbName); try { await mongoose.connection.dropDatabase(); } finally { await mongoose.disconnect(); } });
  await Promise.all([User.init(), Promotion.init(), Booking.init(), PaymentAttempt.init()]);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const actors = {};
  for (const role of ['employee', 'admin', 'member']) actors[role] = await User.create({ fullName: role, email: role + '@promotions.test', password: randomUUID(), role, status: 'Active', memberPoints: 1000 });
  const other = await User.create({ fullName: 'Other Employee', email: 'other@promotions.test', password: randomUUID(), role: 'employee', status: 'Active' });
  const movie = await Movie.create({ title: 'Promotion Movie', classification: 'P', duration: 90 });
  async function request(path, actor = actors.employee, method = 'GET', body, headers = {}) {
    const cookie = actor ? { Cookie: 'token=' + jwt.sign({ id: actor.id, tokenVersion: actor.tokenVersion || 0 }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302') } : {};
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  async function fixture({ price = 200000, unitPrice = 25000, quantity = 2, points = 0, guest = false, extra = {} } = {}) {
    const food = await Food.create({ name: 'Food ' + randomUUID(), price: unitPrice, available: true, stock: 100 });
    const show = await Showtime.create({ movie: movie.id, cinema: 'Test Cinema', room: randomUUID(), price, startTime: new Date(Date.now() + 3600000), seats: [{ number: 'A1' }] });
    const result = await request('/counter/bookings', actors.employee, 'POST', { customerType: guest ? 'guest' : 'member', memberId: guest ? null : actors.member.id,
      showtimeId: show.id, seats: ['A1'], foodItems: quantity ? [{ food: food.id, quantity }] : [], points, ...extra });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return { booking: result.data, show, food };
  }
  const promo = (extra = {}) => Promotion.create({ code: 'P' + randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase(), name: 'Food promotion', discountType: 'percentage', value: 10,
    scope: 'food', minOrder: 50000, stackable: true, startsAt: new Date(Date.now() - 3600000), endsAt: new Date(Date.now() + 3600000), usageLimit: 10, ...extra });
  const promotionPath = fix => `/counter/bookings/${fix.booking._id}/promotion`;
  const apply = (fix, code, actor = actors.employee, headers) => request(promotionPath(fix), actor, 'PATCH', { code }, headers);
  const pay = async fix => { const b = await Booking.findById(fix.booking._id); return request(`/counter/bookings/${b.id}/pay`, actors.employee, 'POST', { method: 'cash', receivedAmount: b.total }); };
  const foodPath = fix => `/counter/bookings/${fix.booking._id}/food`;
  const points = (fix, value) => request(`/counter/bookings/${fix.booking._id}/points`, actors.employee, 'PATCH', { points: value });

  await t.test('active staff ownership, role checks, Origin and JSON protect promotion edits', async () => {
    const fix = await fixture(), p = await promo();
    for (const [actor, status] of [[null, 401], [actors.member, 403], [other, 404]]) assert.equal((await apply(fix, p.code, actor)).status, status);
    assert.equal((await apply(fix, p.code, actors.admin, { Origin: 'https://other.test' })).status, 403);
    assert.equal((await apply(fix, p.code, actors.employee, { 'Content-Type': 'text/plain' })).status, 415);
    for (const code of [null, 10, {}, ['ONE', 'TWO'], '!!bad']) assert.equal((await apply(fix, code)).status, 400);
    assert.equal((await request(promotionPath(fix), actors.employee, 'PATCH', {})).status, 400);
    assert.equal((await apply(fix, p.code, actors.admin)).status, 200);
    assert.equal((await Promotion.findById(p.id)).usedCount, 0);
  });

  await t.test('apply and remove normalize one code and preserve the original hold without consuming stock or usage', async () => {
    const fix = await fixture(), p = await promo();
    const result = await apply(fix, '  ' + p.code.toLowerCase() + '  ');
    assert.equal(result.status, 200);
    assert.equal(result.data.promotion.code, p.code); assert.equal(result.data.promotionDiscount, 5000);
    assert.equal(result.data.discount, 0); assert.equal(result.data.total, 245000);
    assert.equal(result.data.expiresAt, fix.booking.expiresAt); assert.equal(result.data.tickets.length, 0);
    assert.equal((await Food.findById(fix.food.id)).stock, 100); assert.equal((await Promotion.findById(p.id)).usedCount, 0);
    const removed = await apply(fix, ''); assert.equal(removed.status, 200); assert.equal(removed.data.promotionDiscount, 0);
    assert.equal(removed.data.total, 250000); assert.equal(removed.data.promotion, undefined);
    assert.equal((await apply(fix, 'UNKNOWN')).status, 409);
  });

  await t.test('discount scopes, scoped minimum, percentage floor, caps and fixed clamps follow the approved policy', async () => {
    const fix = await fixture({ price: 200001, unitPrice: 33333, quantity: 3 });
    const p = await promo({ value: 17, minOrder: 0 });
    assert.equal((await apply(fix, p.code)).data.promotionDiscount, 16999);
    const capped = await promo({ value: 17, minOrder: 0, maxDiscount: 10000 });
    assert.equal((await apply(fix, capped.code)).data.promotionDiscount, 10000);
    const threshold = await promo({ minOrder: 100000 });
    assert.equal((await apply(fix, threshold.code)).status, 409, 'Food of 99,999 cannot use a 100,000 scoped minimum despite a 300,000 whole order');
    const fixed = await promo({ discountType: 'fixed', value: 999999, scope: 'ticket', minOrder: 0 });
    const ticket = await apply(fix, fixed.code); assert.equal(ticket.data.promotionDiscount, 200001); assert.equal(ticket.data.total, 99999);
    const all = await promo({ value: 50, scope: 'all', minOrder: 0 });
    assert.equal((await apply(fix, all.code)).data.promotionDiscount, 150000);
    const emptyFood = await fixture({ quantity: 0 });
    assert.equal((await apply(emptyFood, p.code)).status, 409);
  });

  await t.test('points apply after promotion; non-stackable codes conflict in both directions without partial updates', async () => {
    const fix = await fixture(), p = await promo();
    await apply(fix, p.code);
    const revised = await points(fix, 100); assert.equal(revised.status, 200); assert.equal(revised.data.total, 145000);
    const noStack = await promo({ stackable: false });
    assert.equal((await apply(fix, noStack.code)).status, 409);
    assert.equal((await Booking.findById(fix.booking._id)).promotion.code, p.code);
    await points(fix, 0); assert.equal((await apply(fix, noStack.code)).status, 200);
    assert.equal((await points(fix, 100)).status, 409); assert.equal((await Booking.findById(fix.booking._id)).pointsUsed, 0);
    const small = await fixture({ price: 100000, quantity: 0 });
    const twenty = await promo({ value: 20, scope: 'ticket', minOrder: 0 }); await apply(small, twenty.code);
    assert.equal((await points(small, 100)).status, 400, '100 points cannot exceed the 80,000 after promotion');
  });

  await t.test('food edits recalculate promotion and roll back the entire edit when minimum or stock fails', async () => {
    const fix = await fixture(), p = await promo(); await apply(fix, p.code);
    const path = foodPath(fix);
    const revised = await request(path, actors.employee, 'PATCH', { foodItems: [{ food: fix.food.id, quantity: 3 }] });
    assert.equal(revised.status, 200); assert.equal(revised.data.promotionDiscount, 7500); assert.equal(revised.data.total, 267500);
    for (const quantity of [1, 101]) assert.equal((await request(path, actors.employee, 'PATCH', { foodItems: [{ food: fix.food.id, quantity }] })).status, 409);
    const stored = await Booking.findById(fix.booking._id); assert.equal(stored.foodItems[0].quantity, 3); assert.equal(stored.total, 267500);
    assert.equal((await Promotion.findById(p.id)).usedCount, 0); assert.equal((await Food.findById(fix.food.id)).stock, 100);
  });

  await t.test('counter creation supports a server-priced code and ignores submitted discount or total; online creation cannot inject it', async () => {
    const p = await promo();
    const fix = await fixture({ extra: { promotionCode: p.code, promotionDiscount: 999999, total: 1, subtotal: 1, promotion: { code: 'FAKE' } } });
    assert.equal(fix.booking.total, 245000); assert.equal(fix.booking.promotion.code, p.code);
    const show = await Showtime.create({ movie: movie.id, cinema: 'Test', room: randomUUID(), startTime: new Date(Date.now() + 3600000), price: 100000, seats: [{ number: 'A1' }] });
    const online = await request('/bookings', actors.member, 'POST', { showtimeId: show.id, seats: ['A1'], promotionCode: p.code });
    assert.equal(online.status, 403); assert.equal((await Showtime.findById(show.id)).seats[0].status, 'available');
  });

  await t.test('payment freezes the accepted prices, persists history and redeems once across concurrent retries', async () => {
    const fix = await fixture(), p = await promo(); await apply(fix, p.code); await points(fix, 100);
    await Food.updateOne({ _id: fix.food.id }, { $set: { price: 999999 } });
    const balance = (await User.findById(actors.member.id)).memberPoints;
    const results = await Promise.all([pay(fix), pay(fix)]); assert.ok(results.every(r => r.status === 200), JSON.stringify(results));
    assert.equal(results[0].data.total, 145000); assert.equal(results[0].data.promotion.code, p.code);
    assert.equal(results[0].data.tickets[0].code, results[1].data.tickets[0].code);
    assert.equal((await Promotion.findById(p.id)).usedCount, 1); assert.equal((await Promotion.findById(p.id)).__v, 1);
    assert.equal((await Food.findById(fix.food.id)).stock, 98); assert.equal((await User.findById(actors.member.id)).memberPoints, balance - 100);
    assert.equal(await PaymentAttempt.countDocuments({ booking: fix.booking._id, status: 'succeeded' }), 1);
    assert.equal((await apply(fix, '')).status, 410);
    const history = await request('/bookings', actors.member); const row = history.data.find(b => b._id === fix.booking._id);
    assert.equal(row.promotion.code, p.code); assert.equal(row.promotionDiscount, 5000);
    const oldForm = await request('/promotions/' + p.id, actors.admin, 'PUT', { ...p.toObject(), version: 0, startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString() });
    assert.equal(oldForm.status, 409, 'Redemption invalidates stale promotion-admin forms');
  });

  await t.test('invalid promotion at cash finalization retains a receipt but leaves points, stock and tickets unchanged', async () => {
    for (const update of [{ active: false }, { deletedAt: new Date() }, { endsAt: new Date(Date.now() - 1000) }, { usedCount: 10 }, { value: 20 }]) {
      const fix = await fixture(), p = await promo(); await apply(fix, p.code); await points(fix, 100);
      const balance = (await User.findById(actors.member.id)).memberPoints;
      await Promotion.updateOne({ _id: p.id }, { $set: update });
      const response = await pay(fix); assert.equal(response.status, 202, JSON.stringify(response));
      const stored = await Booking.findById(fix.booking._id); assert.equal(stored.status, 'pending'); assert.equal(stored.tickets.length, 0);
      assert.equal((await Food.findById(fix.food.id)).stock, 100); assert.equal((await User.findById(actors.member.id)).memberPoints, balance);
      assert.equal((await Showtime.findById(fix.show.id)).seats[0].status, 'held');
      assert.equal(await PaymentAttempt.countDocuments({ booking: fix.booking._id, status: 'unresolved', method: 'cash' }), 1);
      assert.ok(stored.activePayment);
      assert.equal(stored.cashReceived, stored.total);
    }
  });

  await t.test('edited promotion can be explicitly reapplied to accept the new total', async () => {
    const fix = await fixture(), p = await promo(); await apply(fix, p.code);
    await Promotion.updateOne({ _id: p.id }, { $set: { value: 20 }, $inc: { __v: 1 } });
    const requoted = await apply(fix, p.code); assert.equal(requoted.data.total, 240000);
    assert.equal((await pay(fix)).status, 200); assert.equal((await Promotion.findById(p.id)).usedCount, 1);
  });

  await t.test('two orders competing for the last promotion usage have exactly one winner', async () => {
    const first = await fixture(), second = await fixture(), p = await promo({ usageLimit: 1 });
    assert.equal((await apply(first, p.code)).status, 200); assert.equal((await apply(second, p.code)).status, 200);
    const result = await Promise.all([pay(first), pay(second)]); assert.deepEqual(result.map(r => r.status).sort(), [200, 202]);
    assert.equal(await PaymentAttempt.countDocuments({ booking: { $in: [first.booking._id, second.booking._id] }, status: 'unresolved' }), 1);
    assert.equal((await Promotion.findById(p.id)).usedCount, 1);
    assert.equal(await Booking.countDocuments({ _id: { $in: [first.booking._id, second.booking._id] }, status: 'paid' }), 1);
  });

  await t.test('a failed receipt write rolls back promotion usage, stock, points and tickets together', async () => {
    const fix = await fixture(), p = await promo(); await apply(fix, p.code); await points(fix, 100);
    const balance = (await User.findById(actors.member.id)).memberPoints;
    const mocked = t.mock.method(PaymentAttempt, 'create', () => { throw new Error('Private simulated payment storage failure'); });
    try { assert.equal((await pay(fix)).status, 500); } finally { mocked.mock.restore(); }
    assert.equal((await Promotion.findById(p.id)).usedCount, 0); assert.equal((await Promotion.findById(p.id)).__v, 0);
    assert.equal((await Food.findById(fix.food.id)).stock, 100); assert.equal((await User.findById(actors.member.id)).memberPoints, balance);
    const stored = await Booking.findById(fix.booking._id); assert.equal(stored.status, 'pending'); assert.equal(stored.tickets.length, 0);
    assert.equal((await Showtime.findById(fix.show.id)).seats[0].status, 'held');
  });

  await t.test('zero-total promotion orders issue tickets once without collecting cash or points', async () => {
    const fix = await fixture(), p = await promo({ value: 100, scope: 'all', minOrder: 0 });
    const result = await apply(fix, p.code); assert.equal(result.data.total, 0);
    const balance = (await User.findById(actors.member.id)).memberPoints;
    const paid = await pay(fix); assert.equal(paid.status, 200); assert.equal(paid.data.total, 0); assert.equal(paid.data.paymentMethod, 'points');
    assert.equal(paid.data.tickets.length, 1); assert.equal((await User.findById(actors.member.id)).memberPoints, balance);
    assert.equal((await Promotion.findById(p.id)).usedCount, 1);
  });

  await t.test('expired, cancelled and provider-locked orders reject changes without consuming a promotion', async () => {
    const p = await promo();
    for (const update of [{ expiresAt: new Date(Date.now() - 1000) }, { status: 'cancelled' }, { activePayment: 'PENDING-PROVIDER' }]) {
      const fix = await fixture(); await Booking.updateOne({ _id: fix.booking._id }, { $set: update });
      assert.ok([409, 410].includes((await apply(fix, p.code)).status));
    }
    assert.equal((await Promotion.findById(p.id)).usedCount, 0);
  });
});
