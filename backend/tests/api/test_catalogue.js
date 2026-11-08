import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from "../../src/app.js";
import User from "../../src/models/users/User.js";
import Food from "../../src/models/catalogue/Food.js";
import Promotion from "../../src/models/catalogue/Promotion.js";
import FoodSale from "../../src/models/catalogue/FoodSale.js";
import Booking from "../../src/models/bookings/Booking.js";

test('UC-15 F&B and promotion administration', async (t) => {
  const dbName = `cinema_catalogue_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const admin = await User.create({ fullName: 'Admin', email: 'admin@catalogue.test', password: randomUUID(), role: 'admin' });
  const member = await User.create({ fullName: 'Member', email: 'member@catalogue.test', password: randomUUID(), role: 'member', status: 'Active' });
  const employee = await User.create({ fullName: 'Employee', email: 'employee@catalogue.test', password: randomUUID(), role: 'employee' });
  async function request(path, user = admin, method = 'GET', body, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (user) headers.Cookie = 'token=' + jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  const food = { name: 'Popcorn [Test]', description: 'Fresh popcorn', image: '/images/popcorn.png', price: 35000, stock: 50, available: true };
  const promotion = { code: 'food10', name: 'Food 10%', description: '', discountType: 'percentage', value: 10, minOrder: 50000,
    maxDiscount: 30000, scope: 'food', stackable: false, startsAt: new Date(Date.now() - 3600000).toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(), usageLimit: 100, active: true };

  await t.test('all write and Admin read operations enforce Admin role', async () => {
    for (const resource of ['foods', 'promotions']) {
      for (const user of [null, member, employee]) {
        const status = user ? 403 : 401;
        assert.equal((await request(`/${resource}/admin`, user)).status, status);
        assert.equal((await request(`/${resource}/admin/bad-id`, user)).status, status);
        for (const method of ['POST', 'PUT', 'DELETE']) {
          assert.equal((await request(`/${resource}${method === 'POST' ? '' : '/bad-id'}`, user, method, {})).status, status);
        }
      }
      assert.deepEqual((await request(`/${resource}/admin`)).data.items, []);
    }
  });
  let foodId, promoId;
  await t.test('cross-origin and non-JSON writes are rejected', async () => {
    for (const kind of ['foods', 'promotions']) {
      assert.equal((await request(`/${kind}`, admin, 'POST', {}, { Origin: 'https://untrusted.example' })).status, 403);
      assert.equal((await request(`/${kind}`, admin, 'POST', {}, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
      assert.equal((await request(`/${kind}`, admin, 'POST', {}, { 'Content-Type': 'text/plain' })).status, 415);
    }
  });
  await t.test('create Food validates fields and stores creator from the session only', async () => {
    for (const change of [{ name: ' ' }, { price: -1 }, { price: 1.5 }, { stock: -1 }, { stock: '50' }, { available: 'true' }, { image: 'javascript:alert(1)' }]) {
      assert.equal((await request('/foods', admin, 'POST', { ...food, ...change })).status, 400);
    }
    const created = await request('/foods', admin, 'POST', { ...food, createdBy: member._id, deletedAt: new Date().toISOString() });
    assert.equal(created.status, 201);
    foodId = created.data._id;
    assert.equal(created.data.createdBy, String(admin._id));
    assert.equal(created.data.deletedAt, null);
    assert.equal((await request('/foods', admin, 'POST', { ...food, name: ' popcorn [test] ' })).status, 409);
  });
  await t.test('read list supports literal search, pagination, inactive products and legacy stock', async () => {
    await Food.create({ name: 'Hidden Item', price: 10000, stock: 5, available: false });
    assert.equal((await request('/foods/admin?search=%5BTest%5D')).data.total, 1);
    assert.equal((await request('/foods/admin?search=absent')).data.total, 0);
    assert.equal((await request('/foods/admin?limit=1&page=2')).data.items.length, 1);
    assert.equal((await request('/foods/admin?limit=1')).data.totalPages, 2);
    assert.ok(!(await request('/foods', null)).data.some((item) => item.name === 'Hidden Item'));
    for (const query of ['page=-1', 'limit=500', 'search[x]=bad']) assert.equal((await request('/foods/admin?' + query)).status, 400);
    const legacy = await Food.collection.insertOne({ name: 'Legacy Item', price: 10000, available: true, __v: 0 });
    const result = await request(`/foods/${legacy.insertedId}`, admin, 'PUT', { ...food, name: 'Legacy Item', version: 0 });
    assert.equal(result.status, 200);
    assert.equal(result.data.stock, 50);
  });
  await t.test('Food update validates version and cannot overwrite inventory after a sale', async () => {
    const updated = await request(`/foods/${foodId}`, admin, 'PUT', { ...food, price: 40000, version: 0 });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.updatedBy, String(admin._id));
    assert.equal((await request(`/foods/${foodId}`, admin, 'PUT', { ...food, version: 0 })).status, 409);
    await Food.updateOne({ _id: foodId }, { $inc: { stock: -1, __v: 1 } });
    assert.equal((await request(`/foods/${foodId}`, admin, 'PUT', { ...food, version: 1 })).status, 409);
    assert.equal((await Food.findById(foodId)).stock, 49);
  });
  await t.test('pending orders protect removal, price, availability and stock reduction', async () => {
    const order = await FoodSale.create({ employee: employee._id, requestId: randomUUID(), items: [{ food: foodId, name: food.name, unitPrice: 40000, quantity: 1 }], total: 40000 });
    assert.equal((await request(`/foods/${foodId}`, admin, 'DELETE', { version: 2 })).status, 409);
    for (const change of [{ price: 45000 }, { available: false }, { stock: 45 }]) {
      assert.equal((await request(`/foods/${foodId}`, admin, 'PUT', { ...food, price: 40000, stock: 49, version: 2, ...change })).status, 409);
    }
    assert.equal((await request(`/foods/${foodId}`, admin, 'PUT', { ...food, price: 40000, stock: 60, version: 2 })).status, 200);
    await FoodSale.updateOne({ _id: order._id }, { $set: { status: 'paid' } });
    assert.equal((await request(`/foods/${foodId}`, admin, 'DELETE', { version: 3 })).status, 200);
    assert.ok((await Food.findById(foodId)).deletedAt);
    assert.equal((await FoodSale.findById(order._id)).items[0].unitPrice, 40000);
    assert.equal((await request(`/foods/admin/${foodId}`)).status, 404);
    assert.ok(!(await request('/foods', null)).data.some((item) => item._id === foodId));
    assert.equal((await request('/food-sales/catalogue', employee)).data.foods.some((item) => item._id === foodId), false);
  });
  await t.test('unexpired ticket orders also protect F&B references', async () => {
    const item = await Food.create({ ...food, name: 'Booking Food' });
    const booking = await Booking.create({ user: member._id, showtime: new mongoose.Types.ObjectId(), foodItems: [{ food: item._id, quantity: 1 }], subtotal: 35000, total: 35000, expiresAt: new Date(Date.now() + 600000) });
    assert.equal((await request(`/foods/${item._id}`, admin, 'DELETE', { version: 0 })).status, 409);
    await Booking.updateOne({ _id: booking._id }, { $set: { status: 'cancelled' } });
    assert.equal((await request(`/foods/${item._id}`, admin, 'DELETE', { version: 0 })).status, 200);
  });
  await t.test('promotion creation validates dates, amounts, policies and read-only usage', async () => {
    for (const change of [{ code: 'a b' }, { code: 'AB' }, { discountType: 'bad' }, { value: 101 }, { value: 0 }, { scope: 'bad' },
      { stackable: 'false' }, { active: 'true' }, { usageLimit: 0 }, { minOrder: -1 }, { maxDiscount: -1 },
      { endsAt: promotion.startsAt }, { startsAt: '2026-02-30T10:00:00+07:00' }, { startsAt: '2026-11-05' }]) {
      assert.equal((await request('/promotions', admin, 'POST', { ...promotion, ...change })).status, 400, JSON.stringify(change));
    }
    const created = await request('/promotions', admin, 'POST', { ...promotion, usedCount: 99, createdBy: member._id });
    assert.equal(created.status, 201);
    promoId = created.data._id;
    assert.equal(created.data.code, 'FOOD10');
    assert.equal(created.data.usedCount, 0);
    assert.equal(created.data.createdBy, String(admin._id));
    const conflict = await request('/promotions', admin, 'POST', { ...promotion, code: 'FOOD10' });
    assert.equal(conflict.status, 409);
    assert.ok(conflict.data.message.includes('Mã khuyến mãi'));
  });
  await t.test('active promotions exclude expired, future, paused, exhausted and wrong-scope records', async () => {
    const now = Date.now();
    const cases = [
      { code: 'EXPIRED', startsAt: new Date(now - 20000), endsAt: new Date(now - 10000) },
      { code: 'FUTURE', startsAt: new Date(now + 10000), endsAt: new Date(now + 20000) },
      { code: 'PAUSED', active: false }, { code: 'EXHAUSTED', usedCount: 100 }, { code: 'TICKET', scope: 'ticket' }
    ];
    for (const change of cases) await Promotion.create({ ...promotion, code: 'UNUSED', ...change });
    const eligible = await request('/promotions?scope=food', null);
    assert.equal(eligible.status, 200);
    assert.deepEqual(eligible.data.map((item) => item.code), ['FOOD10']);
    assert.equal((await request('/promotions/admin?search=FOOD10')).data.total, 1);
    assert.equal((await request('/promotions?scope=bad', null)).status, 400);
  });
  await t.test('promotion update, fixed discount, usage protection and stale writes', async () => {
    const updated = await request(`/promotions/${promoId}`, admin, 'PUT', { ...promotion, value: 20, version: 0 });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.updatedBy, String(admin._id));
    assert.equal((await request(`/promotions/${promoId}`, admin, 'PUT', { ...promotion, version: 0 })).status, 409);
    await Promotion.updateOne({ _id: promoId }, { $set: { usedCount: 5 } });
    assert.equal((await request(`/promotions/${promoId}`, admin, 'PUT', { ...promotion, value: 20, usageLimit: 4, version: 1 })).status, 400);
    assert.equal((await request(`/promotions/${promoId}`, admin, 'PUT', { ...promotion, value: 30, version: 1 })).status, 409);
    const same = await request(`/promotions/${promoId}`, admin, 'PUT', { ...promotion, value: 20, usedCount: 0, active: false, version: 1 });
    assert.equal(same.status, 200);
    assert.equal(same.data.usedCount, 5);
    const fixed = await request('/promotions', admin, 'POST', { ...promotion, code: 'FIXED10', discountType: 'fixed', value: 10000, maxDiscount: null });
    assert.equal(fixed.status, 201);
    assert.equal((await request('/promotions', admin, 'POST', { ...promotion, code: 'FIXEDBAD', discountType: 'fixed' })).status, 400);
  });
  await t.test('promotion deletion preserves data and reserves its historical code', async () => {
    assert.equal((await request(`/promotions/${promoId}`, admin, 'DELETE', { version: 0 })).status, 409);
    assert.equal((await request(`/promotions/${promoId}`, admin, 'DELETE', { version: 2 })).status, 200);
    const archived = await Promotion.findById(promoId);
    assert.equal(archived.usedCount, 5);
    assert.equal(String(archived.deletedBy), String(admin._id));
    assert.ok(archived.deletedAt);
    assert.equal((await request(`/promotions/admin/${promoId}`)).status, 404);
    assert.equal((await request('/promotions', admin, 'POST', promotion)).status, 409);
  });
  await t.test('unique indexes reject concurrent duplicate names and promotion codes', async () => {
    const products = await Promise.all([request('/foods', admin, 'POST', { ...food, name: 'Concurrent Product' }), request('/foods', admin, 'POST', { ...food, name: 'Concurrent Product' })]);
    assert.deepEqual(products.map((item) => item.status).sort(), [201, 409]);
    const promotions = await Promise.all([request('/promotions', admin, 'POST', { ...promotion, code: 'CONCURRENT' }), request('/promotions', admin, 'POST', { ...promotion, code: 'CONCURRENT' })]);
    assert.deepEqual(promotions.map((item) => item.status).sort(), [201, 409]);
  });
  await t.test('IDs, missing versions and database failure return safe errors without writes', async () => {
    for (const kind of ['foods', 'promotions']) {
      assert.equal((await request(`/${kind}/admin/bad-id`)).status, 400);
      assert.equal((await request(`/${kind}/admin/${new mongoose.Types.ObjectId()}`)).status, 404);
      assert.equal((await request(`/${kind}/bad-id`, admin, 'DELETE', {})).status, 400);
    }
    const mock = t.mock.method(Food, 'countDocuments', async () => { throw new Error('Private database failure'); });
    try {
      const result = await request('/foods/admin');
      assert.equal(result.status, 500);
      assert.equal(result.data.items, undefined);
      assert.ok(!result.data.message.includes('Private database failure'));
    } finally { mock.mock.restore(); }
  });
});
