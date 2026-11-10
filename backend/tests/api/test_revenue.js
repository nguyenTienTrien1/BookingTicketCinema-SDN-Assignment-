import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from "../../src/app.js";
import User from "../../src/models/users/User.js";
import Booking from "../../src/models/bookings/Booking.js";
import FoodSale from "../../src/models/catalogue/FoodSale.js";
import RevenueEntry from "../../src/models/revenue/RevenueEntry.js";
import RevenueReport from "../../src/models/revenue/RevenueReport.js";

test('UC-16.1 revenue dashboard and UC-16.2 matching CSV export', async (t) => {
  const dbName = 'cinema_revenue_test_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', {
    dbName, serverSelectionTimeoutMS: 5000
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/revenue/reports`;
  const admin = await User.create({ fullName: 'Revenue Admin', email: 'admin@revenue.test', role: 'admin', password: randomUUID() });
  const otherAdmin = await User.create({ fullName: 'Other Admin', email: 'other@revenue.test', role: 'admin', password: randomUUID() });
  const member = await User.create({ fullName: 'Member', email: 'member@revenue.test', role: 'member', status: 'Active', password: randomUUID() });
  const employee = await User.create({ fullName: 'Employee', email: 'employee@revenue.test', role: 'employee', password: randomUUID() });
  const inactive = await User.create({ fullName: 'Inactive', email: 'inactive@revenue.test', role: 'admin', status: 'Inactive', password: randomUUID() });
  await Promise.all([RevenueEntry.init(), RevenueReport.init()]);
  const filters = { from: '2020-01-01', to: '2020-01-02', source: 'all', method: 'all', groupBy: 'day' };
  async function request(body = filters, user = admin, path = '', extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (user) headers.Cookie = 'token=' + jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302');
    const response = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text,
      data: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : null };
  }
  async function payment(reference, confirmedAt, extra = {}) {
    const booking = await Booking.create({ user: member._id, showtime: new mongoose.Types.ObjectId(), subtotal: 100000, total: 100000, status: 'paid', paymentStatus: 'paid' });
    return RevenueEntry.create({ booking: booking._id, reference, kind: 'payment', method: 'cash', evidence: 'employee-receipt',
      confirmedAt, gross: 100000, discounts: 0, fees: 0, points: 0, amount: 100000, ...extra });
  }

  await t.test('only active Admin can view and export, including direct API calls', async () => {
    for (const [user, expected] of [[null, 401], [member, 403], [employee, 403], [inactive, 401]]) {
      assert.equal((await request(filters, user)).status, expected);
      assert.equal((await request(filters, user, '/' + new mongoose.Types.ObjectId() + '/export')).status, expected);
    }
    assert.equal(await RevenueReport.countDocuments(), 0);
  });
  await t.test('bad dates, oversized ranges, injection objects and unsupported filters are rejected', async () => {
    for (const body of [null, [], {}, { ...filters, from: '2020-02-30' }, { ...filters, to: '2019-12-31' },
      { ...filters, from: '2020-01-01', to: '2021-01-01' }, { ...filters, from: { $ne: null } },
      { ...filters, source: 'invalid' }, { ...filters, method: 'mock' }, { ...filters, groupBy: 'year' },
      { ...filters, admin: otherAdmin._id }, { ...filters, timezone: 'UTC' }]) {
      assert.equal((await request(body)).status, 400, JSON.stringify(body));
    }
    assert.equal(await RevenueReport.countDocuments(), 0);
    assert.equal((await request(filters, admin, '', { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await request(filters, admin, '', { 'Content-Type': 'text/plain' })).status, 415);
  });
  await t.test('empty period returns true zeros, explicit basis and exportable empty report', async () => {
    const response = await request();
    assert.equal(response.status, 201);
    assert.equal(response.data.totals.net, 0);
    assert.equal(response.data.totals.paymentCount, 0);
    assert.equal(response.data.series.length, 2);
    assert.equal(response.data.timezone, 'Asia/Ho_Chi_Minh');
    const exported = await request(filters, admin, '/' + response.data.reportId + '/export');
    assert.equal(exported.status, 200);
    assert.ok(exported.text.includes('"TỔNG",0,0,0,0,0,0,0,0,0'));
  });
  await t.test('mobile Admin bearer sessions work natively and in development preview without weakening cookie origin checks', async () => {
    const token = user => jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302');
    const previewOrigin = process.env.MOBILE_WEB_ORIGIN || 'http://localhost:8081';
    async function bearer(user = admin, extra = {}) {
      return fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(user)}`, ...extra }, body: JSON.stringify(filters) });
    }
    assert.equal((await bearer()).status, 201);
    for (const user of [member, employee]) assert.equal((await bearer(user)).status, 403);
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      const headers = { Origin: previewOrigin, 'Sec-Fetch-Site': 'cross-site' };
      const response = await bearer(admin, headers);
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await request(filters, admin, '', headers)).status, 403);
      assert.equal((await bearer(admin, { Origin: 'https://evil.test' })).status, 403);
      process.env.NODE_ENV = 'production';
      assert.equal((await bearer(admin, headers)).status, 403);
      assert.equal((await bearer()).status, 201, 'native bearer remains supported in production');
    } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
  });

  const atStart = await payment('START', '2019-12-31T17:00:00.000Z', { gross: 100000, discounts: 10000, fees: 5000, points: 20000, amount: 75000 });
  await payment('SECOND-DAY', '2020-01-01T17:00:00.000Z', { method: 'vnpay', evidence: 'provider-confirmation', gross: 200000, amount: 200000 });
  await payment('POINTS', '2020-01-02T16:59:59.999Z', { method: 'points', evidence: 'points-ledger', gross: 50000, points: 50000, amount: 0 });
  const oldPayment = await payment('OLD', '2019-12-25T12:00:00.000Z', { gross: 40000, amount: 40000 });
  await RevenueEntry.create({ booking: oldPayment.booking, reference: 'REFUND-OLD', originalReference: 'OLD', kind: 'refund', method: 'cash', evidence: 'employee-receipt', confirmedAt: '2020-01-01T05:00:00.000Z', amount: 40000 });
  await payment('BEFORE', '2019-12-31T16:59:59.999Z');
  await payment('AFTER', '2020-01-02T17:00:00.000Z');
  const food = new mongoose.Types.ObjectId();
  const foodSale = {
    employee: employee._id, requestId: randomUUID(), items: [{ food, name: 'Bắp, "lớn"', unitPrice: 30000, quantity: 2 }],
    total: 60000, currency: 'VND', status: 'paid', paymentMethod: 'cash', cashReceived: 100000, change: 40000,
    paymentConfirmedAt: new Date('2020-01-01T09:59:00Z'), paidAt: new Date('2020-01-01T10:00:00Z')
  };
  await FoodSale.create(foodSale);
  for (const status of ['pending', 'cancelled', 'payment_received', 'reconciliation']) {
    await FoodSale.create({ ...foodSale, requestId: randomUUID(), status });
  }
  await FoodSale.create({ ...foodSale, requestId: randomUUID(), paymentConfirmedAt: null });
  // A paid-looking demo booking without trusted settlement evidence contributes nothing.
  await Booking.create({ user: member._id, showtime: new mongoose.Types.ObjectId(), subtotal: 999999, total: 999999, status: 'paid', paymentStatus: 'paid', paymentMethod: 'mock' });
  let captured;

  await t.test('gross, discounts, fees, points, verified refunds and net reconcile exactly', async () => {
    const response = await request();
    assert.equal(response.status, 201, response.text);
    captured = response.data;
    assert.deepEqual(captured.totals, { gross: 410000, discounts: 10000, fees: 5000, points: 70000, payments: 335000, refunds: 40000, net: 295000, paymentCount: 4, refundCount: 1 });
    assert.equal(captured.sources.food.net, 60000);
    assert.equal(captured.sources.tickets.net, 235000);
    assert.equal(captured.excludedFoodSales, 1);
    assert.equal(captured.series[0].period, '2020-01-01');
    assert.equal(captured.series[0].net, 95000);
    assert.equal(captured.series[1].net, 200000);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
  await t.test('source, method and month filters use the same reporting basis', async () => {
    assert.equal((await request({ ...filters, source: 'food' })).data.totals.net, 60000);
    assert.equal((await request({ ...filters, source: 'tickets' })).data.totals.net, 235000);
    assert.equal((await request({ ...filters, method: 'cash' })).data.totals.net, 95000);
    assert.equal((await request({ ...filters, method: 'vnpay' })).data.totals.net, 200000);
    const points = (await request({ ...filters, method: 'points' })).data;
    assert.equal(points.totals.net, 0);
    assert.equal(points.totals.points, 50000);
    assert.equal(points.totals.paymentCount, 1);
    const monthly = (await request({ ...filters, groupBy: 'month' })).data;
    assert.equal(monthly.series.length, 1);
    assert.equal(monthly.series[0].net, 295000);
    const refundOnly = (await request({ ...filters, from: '2020-01-01', to: '2020-01-01', method: 'cash', source: 'tickets' })).data;
    assert.equal(refundOnly.totals.refunds, 40000);
  });
  await t.test('export matches captured result even after new transactions arrive', async () => {
    await payment('LATE-ARRIVAL', '2020-01-01T12:00:00.000Z');
    assert.equal((await request()).data.totals.net, 395000);
    const response = await request(filters, admin, '/' + captured.reportId + '/export');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/csv/);
    assert.match(response.headers.get('content-disposition'), /attachment; filename="revenue_2020-01-01_2020-01-02.csv"/);
    assert.ok(response.text.includes('"TỔNG",410000,10000,5000,70000,335000,40000,295000,4,1'));
    for (const value of [captured.dataTimestamp, captured.timezone, 'Thời điểm xuất', 'Cơ sở ghi nhận', 'Phạm vi dữ liệu']) assert.ok(response.text.includes(value));
    assert.equal(response.text.includes(member.email), false);
    assert.equal(response.text.includes('password'), false);
  });
  await t.test('changed filters, another Admin, missing report and expired snapshot cannot export', async () => {
    const path = '/' + captured.reportId + '/export';
    assert.equal((await request({ ...filters, source: 'food' }, admin, path)).status, 409);
    assert.equal((await request(filters, otherAdmin, path)).status, 404);
    assert.equal((await request(filters, admin, '/bad-id/export')).status, 400);
    assert.equal((await request(filters, admin, '/' + new mongoose.Types.ObjectId() + '/export')).status, 404);
    await RevenueReport.collection.updateOne({ _id: new mongoose.Types.ObjectId(captured.reportId) }, { $set: { expiresAt: new Date(0) } });
    assert.equal((await request(filters, admin, path)).status, 410);
  });
  await t.test('duplicate final settlements and duplicate full refunds cannot be stored', async () => {
    await assert.rejects(RevenueEntry.create({ booking: atStart.booking, reference: 'DUPLICATE', kind: 'payment', method: 'cash', evidence: 'employee-receipt', confirmedAt: new Date(), gross: 1, amount: 1 }), { code: 11000 });
    await assert.rejects(RevenueEntry.create({ booking: oldPayment.booking, reference: 'DUPLICATE-REFUND', originalReference: 'OLD', kind: 'refund', method: 'cash', evidence: 'employee-receipt', confirmedAt: new Date(), amount: 40000 }), { code: 11000 });
  });
  await t.test('invalid financial evidence produces an error and no partial report', async () => {
    const bad = await payment('BAD', '2020-01-01T12:00:00.000Z', { amount: 1 });
    const before = await RevenueReport.countDocuments();
    assert.equal((await request()).status, 409);
    assert.equal(await RevenueReport.countDocuments(), before);
    await RevenueEntry.deleteOne({ _id: bad._id });
    const wrongRefund = await RevenueEntry.create({ booking: atStart.booking, reference: 'BAD-REFUND', originalReference: 'START', kind: 'refund', method: 'cash', evidence: 'employee-receipt', confirmedAt: '2020-01-01T12:00:00.000Z', amount: 1 });
    assert.equal((await request()).status, 409);
    await RevenueEntry.deleteOne({ _id: wrongRefund._id });
  });
  await t.test('database and export generation failures do not return partial data or a CSV file', async () => {
    const before = await RevenueReport.countDocuments();
    const originalFind = FoodSale.find;
    FoodSale.find = () => { throw new Error('Simulated source failure'); };
    try {
      const response = await request();
      assert.equal(response.status, 500);
      assert.equal('totals' in response.data, false);
      assert.equal(response.text.includes('Simulated'), false);
      assert.equal(await RevenueReport.countDocuments(), before);
    } finally { FoodSale.find = originalFind; }
    const snapshot = (await request()).data;
    const originalFindOne = RevenueReport.findOne;
    RevenueReport.findOne = () => { throw new Error('Simulated export failure'); };
    try {
      const response = await request(filters, admin, '/' + snapshot.reportId + '/export');
      assert.equal(response.status, 500);
      assert.equal(response.headers.has('content-disposition'), false);
      assert.match(response.headers.get('content-type'), /application\/json/);
    } finally { RevenueReport.findOne = originalFindOne; }
  });
});
