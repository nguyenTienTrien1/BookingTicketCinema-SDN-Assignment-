import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from './src/app.js';
import Food from './src/models/Food.js';
import FoodSale from './src/models/FoodSale.js';
import User from './src/models/User.js';
import Booking from './src/models/Booking.js';
import { updateFood } from './src/services/catalogueService.js';

test('UC-11 Food-only counter sales', async (t) => {
  const dbName = `cinema_food_sales_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([Food.init(), FoodSale.init()]);
  const employee = await User.create({ fullName: 'Employee', email: 'employee@food.test', password: randomUUID(), role: 'employee' });
  const other = await User.create({ fullName: 'Other Employee', email: 'other@food.test', password: randomUUID(), role: 'employee' });
  const admin = await User.create({ fullName: 'Admin', email: 'admin@food.test', password: randomUUID(), role: 'admin' });
  const member = await User.create({ fullName: 'Member', email: 'member@food.test', password: randomUUID(), role: 'member', status: 'Active' });
  const food = await Food.create({ name: 'Popcorn', price: 25000, stock: 40 });
  const drink = await Food.create({ name: 'Water', price: 10000, stock: 20 });
  async function request(path, user = employee, method = 'GET', body) {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Cookie = 'token=' + jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/food-sales${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
  }
  async function order(items = [{ food: String(food._id), quantity: 2 }, { food: String(drink._id), quantity: 1 }]) {
    return request('', employee, 'POST', { requestId: randomUUID(), items });
  }
  const payment = (total, cashReceived = 100000) => ({ paymentMethod: 'cash', confirmedTotal: total, cashReceived, paymentConfirmed: true });
  const ready = (await request('/catalogue')).data.paymentsEnabled;
  await t.test('only Employees can access counter operations', async () => {
    for (const user of [null, member, admin]) {
      assert.equal((await request('/catalogue', user)).status, user ? 403 : 401);
      assert.equal((await request('', user, 'POST', { requestId: randomUUID(), items: [] })).status, user ? 403 : 401);
    }
  });
  await t.test('empty, invalid, duplicated and unavailable selections are rejected', async () => {
    for (const items of [[], [{ food: 'bad', quantity: 1 }], [{ food: String(food._id), quantity: -1 }],
      [{ food: String(food._id), quantity: 1.5 }], [{ food: String(food._id), quantity: 99 }],
      [{ food: String(food._id), quantity: 1 }, { food: String(food._id), quantity: 1 }],
      [{ food: String(food._id), quantity: 1 }, { food: String(food._id).toUpperCase(), quantity: 1 }]]) {
      assert.ok((await order(items)).status >= 400);
    }
    assert.equal(await FoodSale.countDocuments(), 0);
  });
  await t.test('quote uses server prices, does not change stock, and replay creates one order', async () => {
    const body = { requestId: randomUUID(), total: 1, employee: other._id, items: [{ food: String(food._id), quantity: 2, price: 1 }] };
    const first = await request('', employee, 'POST', body);
    const replay = await request('', employee, 'POST', body);
    assert.equal(first.status, 201);
    assert.equal(first.data.total, 50000);
    assert.equal(first.data.employee, String(employee._id));
    assert.equal(first.data._id, replay.data._id);
    assert.equal((await Food.findById(food._id)).stock, 40);
    assert.equal((await request(`/${first.data._id}`, other)).status, 404);
    assert.equal((await request(`/${first.data._id}/pay`, other, 'POST', payment(50000))).status, 404);
    assert.equal((await request(`/${first.data._id}/cancel`, other, 'POST')).status, 404);
  });
  await t.test('cancelling an unpaid order preserves stock and blocks payment', async () => {
    const sale = (await order()).data;
    assert.equal((await request(`/${sale._id}/cancel`, employee, 'POST')).data.status, 'cancelled');
    assert.equal((await request(`/${sale._id}/pay`, employee, 'POST', payment(sale.total))).status, 409);
    assert.equal((await Food.findById(food._id)).stock, 40);
  });
  if (!ready) {
    await t.test('standalone MongoDB rejects payment before recording cash or changing stock', async () => {
      const sale = (await order()).data;
      assert.equal((await request(`/${sale._id}/pay`, employee, 'POST', payment(sale.total))).status, 503);
      assert.equal((await FoodSale.findById(sale._id)).status, 'pending');
      assert.equal((await Food.findById(food._id)).stock, 40);
    });
    t.diagnostic('Transaction tests require TEST_MONGODB_URI pointing to a replica set.');
    return;
  }
  await t.test('unconfirmed or mismatched payment cannot deduct stock', async () => {
    const sale = (await order()).data;
    for (const body of [{}, { ...payment(sale.total), paymentConfirmed: false }, payment(1), payment(sale.total, 1)]) {
      assert.equal((await request(`/${sale._id}/pay`, employee, 'POST', body)).status, 400);
    }
    assert.equal((await FoodSale.findById(sale._id)).status, 'pending');
    assert.equal((await Food.findById(food._id)).stock, 40);
  });
  await t.test('cash confirmation issues one receipt, deducted exactly once under concurrent retries', async () => {
    const sale = (await order()).data;
    const responses = await Promise.all([
      request(`/${sale._id}/pay`, employee, 'POST', payment(sale.total)),
      request(`/${sale._id}/pay`, employee, 'POST', payment(sale.total))
    ]);
    for (const result of responses) { assert.equal(result.status, 200); assert.equal(result.data.status, 'paid'); }
    const replay = await request(`/${sale._id}/pay`, employee, 'POST', payment(sale.total));
    assert.equal(replay.data._id, sale._id);
    assert.equal(replay.data.change, 40000);
    assert.equal((await Food.findById(food._id)).stock, 38);
    assert.equal((await Food.findById(drink._id)).stock, 19);
    assert.equal((await request(`/${sale._id}/cancel`, employee, 'POST')).status, 409);
    assert.equal(await Booking.countDocuments(), 0);
  });
  await t.test('a real completed sale invalidates the Admin inventory snapshot', async () => {
    await assert.rejects(updateFood(String(food._id), {
      name: food.name, price: food.price, stock: 40, available: true, version: 0
    }, admin._id), { status: 409 });
    assert.equal((await Food.findById(food._id)).stock, 38);
  });
  await t.test('price changes roll back all stock writes and retain cash for reconciliation', async () => {
    const sale = (await order()).data;
    await Food.updateOne({ _id: drink._id }, { $set: { price: 15000 } });
    const result = await request(`/${sale._id}/pay`, employee, 'POST', payment(sale.total));
    assert.equal(result.status, 409);
    const saved = await FoodSale.findById(sale._id);
    assert.equal(saved.status, 'reconciliation');
    assert.equal(saved.cashReceived, 100000);
    assert.equal((await Food.findById(food._id)).stock, 38);
    assert.equal((await Food.findById(drink._id)).stock, 19);
  });
  await t.test('two orders cannot oversell the last item', async () => {
    const scarce = await Food.create({ name: 'Last Item', price: 10000, stock: 1 });
    const items = [{ food: String(scarce._id), quantity: 1 }];
    const a = (await order(items)).data;
    const b = (await order(items)).data;
    const results = await Promise.all([request(`/${a._id}/pay`, employee, 'POST', payment(a.total)), request(`/${b._id}/pay`, employee, 'POST', payment(b.total))]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal((await Food.findById(scarce._id)).stock, 0);
    assert.equal(await FoodSale.countDocuments({ _id: { $in: [a._id, b._id] }, status: 'paid' }), 1);
    assert.equal(await FoodSale.countDocuments({ _id: { $in: [a._id, b._id] }, status: 'reconciliation' }), 1);
  });
  await t.test('database failure during finalization rolls back stock and preserves the cash receipt', async () => {
    const sale = (await order([{ food: String(food._id), quantity: 1 }])).data;
    const mock = t.mock.method(Food, 'updateOne', async () => { throw new Error('Injected stock write failure'); });
    try { assert.equal((await request(`/${sale._id}/pay`, employee, 'POST', payment(sale.total))).status, 409); }
    finally { mock.mock.restore(); }
    assert.equal((await FoodSale.findById(sale._id)).status, 'reconciliation');
    assert.equal((await Food.findById(food._id)).stock, 38);
  });
});
