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
import Booking from './src/models/Booking.js';
import RevenueEntry from './src/models/RevenueEntry.js';

test('UC-7.2 QR tickets', async (t) => {
  const dbName = 'cinema_tickets_test_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    assert.equal(mongoose.connection.name, dbName);
    try { await mongoose.connection.dropDatabase(); } finally { await mongoose.disconnect(); }
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const member = await User.create({ fullName: 'Ticket Member', email: 'member@tickets.test', password: randomUUID(), status: 'Active' });
  const other = await User.create({ fullName: 'Other Member', email: 'other@tickets.test', password: randomUUID(), status: 'Active' });
  const employee = await User.create({ fullName: 'Employee One', email: 'employee@tickets.test', password: randomUUID(), role: 'employee' });
  const secondEmployee = await User.create({ fullName: 'Employee Two', email: 'employee2@tickets.test', password: randomUUID(), role: 'employee' });
  const admin = await User.create({ fullName: 'Admin', email: 'admin@tickets.test', password: randomUUID(), role: 'admin' });
  const inactive = await User.create({ fullName: 'Inactive', email: 'inactive@tickets.test', password: randomUUID(), role: 'employee', status: 'Inactive' });
  await Promise.all([Booking.init(), RevenueEntry.init()]);
  function token(user) { return jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302', { expiresIn: '5m' }); }
  async function request(path, user = member, method = 'GET', body, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (user) headers.Cookie = 'token=' + token(user);
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
  }
  async function fixture({ offset = 5, proof = true, paid = true, classification = 'P', ageLimit = 0 } = {}) {
    const movie = await Movie.create({ title: 'Ticket ' + randomUUID(), classification, ageLimit });
    const bookingId = new mongoose.Types.ObjectId();
    const showtime = await Showtime.create({ movie: movie._id, cinema: 'Cinema+', room: 'Room 1', price: 80000,
      startTime: new Date(Date.now() + offset * 60000), seats: ['A1', 'A2'].map((number) => ({ number, status: paid ? 'booked' : 'held', bookingId,
        holdUntil: paid ? null : new Date(Date.now() + 600000) })) });
    const booking = await Booking.create({ _id: bookingId, user: member._id, showtime: showtime._id, seats: ['A1', 'A2'], subtotal: 160000, total: 160000,
      status: paid ? 'paid' : 'pending', paymentStatus: paid ? 'paid' : 'unpaid', paymentMethod: proof ? 'vnpay' : 'mock',
      paymentRef: proof ? 'PROVIDER-' + randomUUID() : 'PAY-' + Date.now(), expiresAt: new Date(Date.now() + 600000) });
    if (proof && paid) await RevenueEntry.create({ booking: booking._id, kind: 'payment', reference: booking.paymentRef, method: 'vnpay',
      evidence: 'provider-confirmation', confirmedAt: new Date(), gross: 160000, amount: 160000 });
    return { booking, showtime, movie };
  }
  const ownedPath = (booking) => `/bookings/${booking._id}/tickets`;
  const lookupPath = (ref, showtime) => `/tickets/lookup?reference=${encodeURIComponent(ref)}&showtimeId=${showtime._id}`;
  const checkPath = (ref) => `/tickets/${encodeURIComponent(ref)}/check-in`;
  async function issue(fix) {
    const result = await request(ownedPath(fix.booking));
    assert.equal(result.status, 200);
    return result.data;
  }

  const main = await fixture();
  await t.test('only the authenticated Member can read owned QR tickets', async () => {
    for (const [user, status] of [[null, 401], [other, 404], [employee, 403], [admin, 403]]) {
      assert.equal((await request(ownedPath(main.booking), user)).status, status);
    }
    assert.equal((await request('/bookings/invalid/tickets')).status, 400);
  });

  let mainTickets;
  await t.test('parallel QR views issue one persistent unguessable reference per seat', async () => {
    const responses = await Promise.all([request(ownedPath(main.booking)), request(ownedPath(main.booking))]);
    assert.ok(responses.every((result) => result.status === 200));
    mainTickets = responses[0].data;
    assert.deepEqual(mainTickets.tickets.map((ticket) => ticket.reference), responses[1].data.tickets.map((ticket) => ticket.reference));
    assert.equal(mainTickets.mode, 'verified');
    assert.equal(new Set(mainTickets.tickets.map((ticket) => ticket.reference)).size, 2);
    assert.equal(responses[0].cache, 'no-store');
    for (const ticket of mainTickets.tickets) {
      assert.match(ticket.reference, /^CT-[A-F0-9]{32}$/);
      assert.equal(ticket.status, 'issued');
      assert.equal('checkedInBy' in ticket, false);
      const png = Buffer.from(ticket.qrDataUrl.split(',')[1], 'base64');
      assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    }
    assert.equal((await Booking.findById(main.booking._id)).tickets.length, 2);
    assert.equal(JSON.stringify(mainTickets).includes(member.email), false);
  });

  await t.test('unpaid, cancelled, unverified and refunded orders never expose usable QR', async () => {
    const pending = await fixture({ paid: false });
    assert.deepEqual((await issue(pending)).tickets, []);
    assert.equal((await Booking.findById(pending.booking._id)).tickets.length, 0);
    const unverified = await fixture();
    await RevenueEntry.deleteMany({ booking: unverified.booking._id });
    assert.deepEqual((await issue(unverified)).tickets, []);
    const refunded = await fixture();
    await RevenueEntry.create({ booking: refunded.booking._id, kind: 'refund', reference: 'REFUND-' + randomUUID(), originalReference: refunded.booking.paymentRef,
      method: 'vnpay', evidence: 'provider-confirmation', confirmedAt: new Date(), amount: 160000 });
    assert.deepEqual((await issue(refunded)).tickets, []);
    const cancelled = await fixture();
    await Booking.updateOne({ _id: cancelled.booking._id }, { $set: { status: 'cancelled' } });
    assert.deepEqual((await issue(cancelled)).tickets, []);
    const mismatched = await fixture();
    await RevenueEntry.collection.updateOne({ booking: mismatched.booking._id }, { $set: { amount: 1 } });
    assert.deepEqual((await issue(mismatched)).tickets, []);
  });

});
