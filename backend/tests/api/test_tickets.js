import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from "../../src/app.js";
import User from "../../src/models/users/User.js";
import Movie from "../../src/models/movies/Movie.js";
import Showtime from "../../src/models/cinema/Showtime.js";
import Booking from "../../src/models/bookings/Booking.js";
import RevenueEntry from "../../src/models/revenue/RevenueEntry.js";
import PaymentAttempt from "../../src/models/payments/PaymentAttempt.js";

test('UC-7.2 QR tickets and UC-10/10.1 single-use check-in', async (t) => {
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
  await Promise.all([Booking.init(), RevenueEntry.init(), PaymentAttempt.init()]);
  function token(user) { return jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302', { expiresIn: '5m' }); }
  async function request(path, user = member, method = 'GET', body, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (user) headers.Cookie = 'token=' + token(user);
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
  }
  async function fixture({ offset = 5, proof = true, paid = true, classification = 'P', ageLimit = 0 } = {}) {
    const movie = await Movie.create({ title: 'Ticket ' + randomUUID(), classification, ageLimit });
    const bookingId = new mongoose.Types.ObjectId();
    const showtime = await Showtime.create({
      movie: movie._id, cinema: 'Cinema+', room: 'Room 1', price: 80000,
      startTime: new Date(Date.now() + offset * 60000), seats: ['A1', 'A2'].map((number) => ({
        number, status: paid ? 'booked' : 'held', bookingId,
        holdUntil: paid ? null : new Date(Date.now() + 600000)
      }))
    });
    const booking = await Booking.create({
      _id: bookingId, user: member._id, showtime: showtime._id, seats: ['A1', 'A2'], subtotal: 160000, total: 160000,
      status: paid ? 'paid' : 'pending', paymentStatus: paid ? 'paid' : 'unpaid', paymentMethod: proof ? 'vnpay' : 'mock',
      paymentRef: proof ? 'PROVIDER-' + randomUUID() : 'PAY-' + Date.now(), expiresAt: new Date(Date.now() + 600000),
      ...(paid ? {
        ticketMode: proof ? 'verified' : 'demo',
        ticketContext: { startTime: showtime.startTime, movieTitle: movie.title, cinema: showtime.cinema, room: showtime.room, classification, ageLimit },
        tickets: ['A1', 'A2'].map(seat => ({ seat, reference: 'CT-' + randomUUID().replaceAll('-', '').toUpperCase(), status: 'issued', issuedAt: new Date() }))
      } : {})
    });
    if (proof && paid) await RevenueEntry.create({
      booking: booking._id, kind: 'payment', reference: booking.paymentRef, method: 'vnpay',
      evidence: 'provider-confirmation', confirmedAt: new Date(), gross: 160000, amount: 160000
    });
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
  await t.test('Member ownership and active Employee authorization protect all routes', async () => {
    for (const [user, status] of [[null, 401], [other, 404], [employee, 403], [admin, 403]]) {
      assert.equal((await request(ownedPath(main.booking), user)).status, status);
    }
    for (const [user, status] of [[null, 401], [member, 403], [admin, 403], [inactive, 401]]) {
      assert.equal((await request('/tickets/showtimes', user)).status, status);
      assert.equal((await request(lookupPath('CT-' + 'A'.repeat(32), main.showtime), user)).status, status);
      assert.equal((await request(checkPath('CT-' + 'A'.repeat(32)), user, 'POST', { showtimeId: main.showtime._id })).status, status);
    }
    assert.equal((await request('/bookings/invalid/tickets')).status, 400);
  });

  let mainTickets;
  await t.test('parallel QR views return existing references without writing the booking', async () => {
    const before = await Booking.findById(main.booking._id).lean();
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
    assert.deepEqual(await Booking.findById(main.booking._id).lean(), before);
    assert.equal(JSON.stringify(mainTickets).includes(member.email), false);
  });

  await t.test('viewing a paid booking without issued tickets never creates them or changes sale data', async () => {
    const fix = await fixture();
    await Booking.updateOne({ _id: fix.booking._id }, { $set: { tickets: [] }, $unset: { ticketContext: '', ticketMode: '' } });
    const before = await Booking.findById(fix.booking._id).lean();
    const seats = await Showtime.findById(fix.showtime._id).lean();
    const responses = await Promise.all([request(ownedPath(fix.booking)), request(ownedPath(fix.booking))]);
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal(response.data.bookingStatus, 'paid');
      assert.deepEqual(response.data.tickets, []);
      assert.ok(response.data.message);
    }
    assert.deepEqual(await Booking.findById(fix.booking._id).lean(), before);
    assert.deepEqual(await Showtime.findById(fix.showtime._id).lean(), seats);
    assert.equal(await PaymentAttempt.countDocuments({ booking: fix.booking._id }), 0);
    assert.equal(await RevenueEntry.countDocuments({ booking: fix.booking._id }), 1);
  });

  await t.test('pending and completed refunds show their current status without usable tickets or writes', async () => {
    for (const status of ['refund-requested', 'refunded']) {
      const fix = await fixture();
      // UC7.1 will produce these states; simulate its persisted result here.
      await Booking.collection.updateOne({ _id: fix.booking._id }, { $set: { status } });
      const before = await Booking.findById(fix.booking._id).lean();
      const data = await issue(fix);
      assert.equal(data.bookingStatus, status);
      assert.deepEqual(data.tickets, []);
      assert.ok(data.message);
      assert.deepEqual(await Booking.findById(fix.booking._id).lean(), before);
    }
  });

  await t.test('inconsistent issued references or seats do not expose usable QR', async () => {
    for (const change of [{ 'tickets.1.reference': null }, { 'tickets.1.seat': 'A1' }]) {
      const fix = await fixture();
      await Booking.updateOne({ _id: fix.booking._id }, { $set: change });
      assert.equal((await request(ownedPath(fix.booking))).status, 409);
    }
  });

  await t.test('unpaid, cancelled, unverified and refunded orders never expose usable QR', async () => {
    const pending = await fixture({ paid: false });
    assert.deepEqual((await issue(pending)).tickets, []);
    assert.equal((await Booking.findById(pending.booking._id)).tickets.length, 0);
    const unverified = await fixture();
    await RevenueEntry.deleteMany({ booking: unverified.booking._id });
    assert.deepEqual((await issue(unverified)).tickets, []);
    const refunded = await fixture();
    await RevenueEntry.create({
      booking: refunded.booking._id, kind: 'refund', reference: 'REFUND-' + randomUUID(), originalReference: refunded.booking.paymentRef,
      method: 'vnpay', evidence: 'provider-confirmation', confirmedAt: new Date(), amount: 160000
    });
    assert.deepEqual((await issue(refunded)).tickets, []);
    const cancelled = await fixture();
    await Booking.updateOne({ _id: cancelled.booking._id }, { $set: { status: 'cancelled' } });
    assert.deepEqual((await issue(cancelled)).tickets, []);
    const mismatched = await fixture();
    await RevenueEntry.collection.updateOne({ booking: mismatched.booking._id }, { $set: { amount: 1 } });
    assert.deepEqual((await issue(mismatched)).tickets, []);
  });

  await t.test('lookup is read-only, validates the chosen showtime and shows the admission window', async () => {
    const ref = mainTickets.tickets[0].reference;
    const response = await request(lookupPath(ref, main.showtime), employee);
    assert.equal(response.status, 200);
    assert.equal(response.data.eligible, true);
    assert.equal(response.data.requiresAgeCheck, false);
    assert.equal(response.data.window.openBeforeMinutes, 30);
    assert.equal(response.data.window.closeAfterMinutes, 15);
    assert.equal('user' in response.data, false);
    assert.equal((await Booking.findById(main.booking._id)).tickets[0].status, 'issued');
    const wrong = await request(lookupPath(ref, { _id: new mongoose.Types.ObjectId() }), employee);
    assert.equal(wrong.data.eligible, false);
    assert.equal((await request(checkPath(ref), employee, 'POST', { showtimeId: new mongoose.Types.ObjectId() })).status, 409);
    assert.equal((await request('/tickets/lookup?reference[$ne]=x', employee)).status, 400);
    assert.equal((await request(lookupPath('CT-' + '0'.repeat(32), main.showtime), employee)).status, 404);
    const list = await request('/tickets/showtimes', employee);
    assert.equal(list.status, 200);
    assert.equal('seats' in list.data.showtimes[0], false);
  });

  await t.test('two simultaneous check-ins admit exactly once, preserve the other seat and record the real employee', async () => {
    const ref = mainTickets.tickets[0].reference;
    const body = { showtimeId: main.showtime._id, employeeId: admin._id };
    const results = await Promise.all([request(checkPath(ref), employee, 'POST', body), request(checkPath(ref), secondEmployee, 'POST', body)]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(results.find((result) => result.status === 200).data.admissionGranted, true);
    const saved = await Booking.findById(main.booking._id);
    assert.equal(saved.tickets[0].status, 'checked-in');
    assert.ok(saved.tickets[0].checkedInAt);
    assert.ok([String(employee._id), String(secondEmployee._id)].includes(String(saved.tickets[0].checkedInBy)));
    assert.equal(saved.tickets[1].status, 'issued');
    assert.equal((await request(checkPath(ref), employee, 'POST', body)).status, 409);
    const viewed = await issue(main);
    assert.equal(viewed.tickets[0].qrDataUrl, null);
    assert.ok(viewed.tickets[1].qrDataUrl);
  });

  await t.test('restricted classifications require an Employee age/guardian check before any status change', async () => {
    for (const classification of ['T18', 'K']) {
      const fix = await fixture({ classification });
      const ref = (await issue(fix)).tickets[0].reference;
      assert.equal((await request(lookupPath(ref, fix.showtime), employee)).data.requiresAgeCheck, true);
      assert.equal((await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id })).status, 400);
      assert.equal((await Booking.findById(fix.booking._id)).tickets[0].status, 'issued');
      assert.equal((await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id, ageVerified: true })).status, 200);
    }
  });

  await t.test('too-early and expired tickets cannot check in; cinema window configuration is honored', async () => {
    for (const offset of [45, -20]) {
      const fix = await fixture({ offset });
      const data = await issue(fix), ref = data.tickets[0].reference;
      assert.equal((await request(lookupPath(ref, fix.showtime), employee)).data.eligible, false);
      assert.equal((await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id })).status, 409);
      if (offset < 0) { assert.equal(data.tickets[0].status, 'expired'); assert.equal(data.tickets[0].qrDataUrl, null); }
    }
    const previous = process.env.CHECKIN_OPEN_MINUTES;
    try {
      process.env.CHECKIN_OPEN_MINUTES = '60';
      const fix = await fixture({ offset: 45 });
      const ref = (await issue(fix)).tickets[0].reference;
      assert.equal((await request(lookupPath(ref, fix.showtime), employee)).data.eligible, true);
    } finally { if (previous === undefined) delete process.env.CHECKIN_OPEN_MINUTES; else process.env.CHECKIN_OPEN_MINUTES = previous; }
  });

  await t.test('a changed booking, seat owner or concurrent refund prevents admission', async () => {
    const fix = await fixture();
    const ref = (await issue(fix)).tickets[0].reference;
    const original = Booking.findOneAndUpdate;
    const mocked = t.mock.method(Booking, 'findOneAndUpdate', async function (...args) {
      await Booking.updateOne({ _id: fix.booking._id }, { $set: { status: 'cancelled' } });
      return original.apply(this, args);
    });
    try { assert.equal((await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id })).status, 409); }
    finally { mocked.mock.restore(); }
    assert.equal((await Booking.findById(fix.booking._id)).tickets[0].status, 'issued');
    const released = await fixture();
    const releasedRef = (await issue(released)).tickets[0].reference;
    await Showtime.updateOne({ _id: released.showtime._id }, { $set: { 'seats.0.status': 'available', 'seats.0.bookingId': null } });
    assert.equal((await request(checkPath(releasedRef), employee, 'POST', { showtimeId: released.showtime._id })).status, 409);
    const refund = await fixture();
    const refundRef = (await issue(refund)).tickets[0].reference;
    await Booking.collection.updateOne({ _id: refund.booking._id }, { $set: { status: 'refund-requested' } });
    assert.equal((await request(checkPath(refundRef), employee, 'POST', { showtimeId: refund.showtime._id })).status, 409);
  });

  await t.test('payment, classification and selected seat must still match when check-in is saved', async () => {
    for (const change of [{ paymentRef: 'CHANGED-PAYMENT' }, { total: 1 }, { 'ticketContext.classification': 'T18' },
    { 'ticketContext.room': 'Another Room' }, { seats: ['A2'] }]) {
      const fix = await fixture();
      const ref = (await issue(fix)).tickets[0].reference;
      const original = Booking.findOneAndUpdate;
      const mocked = t.mock.method(Booking, 'findOneAndUpdate', async function (...args) {
        await Booking.updateOne({ _id: fix.booking._id }, { $set: change });
        return original.apply(this, args);
      });
      try { assert.equal((await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id })).status, 409); }
      finally { mocked.mock.restore(); }
      assert.equal((await Booking.findById(fix.booking._id)).tickets[0].status, 'issued');
    }
  });

  await t.test('database admission deadline still applies when the write is delayed', async () => {
    const fix = await fixture({ offset: -14.98 });
    const ref = (await issue(fix)).tickets[0].reference;
    const original = Booking.findOneAndUpdate;
    const mocked = t.mock.method(Booking, 'findOneAndUpdate', async function (...args) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return original.apply(this, args);
    });
    try { assert.equal((await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id })).status, 409); }
    finally { mocked.mock.restore(); }
    assert.equal((await Booking.findById(fix.booking._id)).tickets[0].status, 'issued');
  });

  await t.test('different seats in one booking may check in concurrently; duplicate references are rejected', async () => {
    const fix = await fixture();
    const data = await issue(fix);
    const responses = await Promise.all(data.tickets.map(ticket => request(checkPath(ticket.reference), employee, 'POST', { showtimeId: fix.showtime._id })));
    assert.deepEqual(responses.map(result => result.status), [200, 200]);
    assert.ok((await Booking.findById(fix.booking._id)).tickets.every(ticket => ticket.status === 'checked-in'));
    const duplicate = await fixture();
    const reference = duplicate.booking.tickets[0].reference;
    await Booking.updateOne({ _id: duplicate.booking._id }, { $set: { 'tickets.1.reference': reference } });
    assert.equal((await request(checkPath(reference), employee, 'POST', { showtimeId: duplicate.showtime._id })).status, 409);
  });

  await t.test('uncertain storage results never claim admission and retries cannot use the ticket again', async () => {
    const fix = await fixture();
    const ref = (await issue(fix)).tickets[0].reference;
    const original = Booking.findOneAndUpdate;
    const mocked = t.mock.method(Booking, 'findOneAndUpdate', async function (...args) { await original.apply(this, args); throw new Error('Unknown write result'); });
    try {
      const response = await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id });
      assert.equal(response.status, 503);
      assert.equal('admissionGranted' in response.data, false);
    } finally { mocked.mock.restore(); }
    assert.equal((await request(lookupPath(ref, fix.showtime), employee)).data.status, 'checked-in');
    assert.equal((await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id })).status, 409);
  });

  await t.test('simulated payments issue clearly marked demo QR without claiming real admission', async () => {
    const fix = await fixture({ paid: false, proof: false });
    const previousSimulation = process.env.ENABLE_PAYMENT_SIMULATION;
    process.env.ENABLE_PAYMENT_SIMULATION = 'true';
    t.after(() => { if (previousSimulation === undefined) delete process.env.ENABLE_PAYMENT_SIMULATION; else process.env.ENABLE_PAYMENT_SIMULATION = previousSimulation; });
    assert.equal((await request(`/bookings/${fix.booking._id}/pay`, member, 'POST', { method: 'demo' })).status, 200);
    const stored = await Booking.findById(fix.booking._id);
    assert.equal(stored.tickets.length, 2);
    const data = await issue(fix), ref = data.tickets[0].reference;
    assert.equal(data.mode, 'demo');
    assert.match(ref, /^[a-f0-9]{48}$/);
    const result = await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id });
    assert.equal(result.status, 200);
    assert.equal(result.data.admissionGranted, false);
    assert.equal(await RevenueEntry.countDocuments({ booking: fix.booking._id }), 0);
    const previous = { env: process.env.NODE_ENV, secret: process.env.JWT_SECRET };
    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET ||= 'supersecret_cinema_jwt_key_2026_sdn302';
      assert.deepEqual((await issue(fix)).tickets, []);
      assert.equal((await request(lookupPath(ref, fix.showtime), employee)).data.eligible, false);
    } finally {
      if (previous.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.env;
      if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
    }
  });

  await t.test('transactional cash settlement keeps the same code and JSON QR through atomic check-in and payment retry', async () => {
    const fix = await fixture({ paid: false, proof: false });
    const path = `/payments/bookings/${fix.booking._id}/cash`;
    const body = { method: 'cash', receivedAmount: fix.booking.total };
    const paid = await request(path, employee, 'POST', body);
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    const original = paid.data.tickets[0];
    assert.match(original.code, /^[a-f0-9]{48}$/);
    assert.equal(original.reference, original.code);
    assert.equal(original.status, 'valid');
    assert.equal(await RevenueEntry.countDocuments({ booking: fix.booking._id }), 1);
    const owned = await issue(fix);
    assert.equal(owned.mode, 'verified');
    assert.equal(owned.tickets[0].reference, original.code);
    assert.equal(owned.tickets[0].qrDataUrl, original.qr);
    assert.equal(owned.tickets[0].status, 'issued');
    const payload = JSON.stringify({ ticket: original.code, booking: String(fix.booking._id), seat: original.seat });
    assert.equal((await request(lookupPath(payload, fix.showtime), employee)).data.eligible, true);
    const checked = await request(checkPath(payload), employee, 'POST', { showtimeId: fix.showtime._id });
    assert.equal(checked.status, 200);
    assert.equal(checked.data.admissionGranted, true);
    const retry = await request(path, employee, 'POST', body);
    assert.equal(retry.status, 200);
    assert.equal(retry.data.tickets[0].code, original.code);
    assert.equal(retry.data.tickets[0].qr, original.qr);
    assert.equal(retry.data.tickets[0].status, 'checked-in');
    assert.equal((await request(checkPath(original.code), secondEmployee, 'POST', { showtimeId: fix.showtime._id })).status, 409);
    assert.equal(await PaymentAttempt.countDocuments({ booking: fix.booking._id, status: 'succeeded' }), 1);
  });

  await t.test('viewing existing code-only tickets derives metadata without writing; check-in stays compatible', async () => {
    const fix = await fixture({ paid: false, proof: false });
    const paid = await request(`/payments/bookings/${fix.booking._id}/cash`, employee, 'POST', { method: 'cash', receivedAmount: fix.booking.total });
    assert.equal(paid.status, 200);
    const codes = paid.data.tickets.map(ticket => ticket.code);
    await Booking.collection.updateOne({ _id: fix.booking._id }, { $unset: { ticketContext: '', ticketMode: '', 'tickets.0.reference': '', 'tickets.1.reference': '', 'tickets.0.issuedAt': '', 'tickets.1.issuedAt': '' }, $set: { 'tickets.1.status': 'checked-in' } });
    const before = await Booking.findById(fix.booking._id).lean();
    const viewed = await request(ownedPath(fix.booking));
    assert.equal(viewed.status, 200);
    assert.deepEqual(viewed.data.tickets.map(ticket => ticket.reference), codes);
    assert.equal(viewed.data.tickets[1].qrDataUrl, null);
    assert.deepEqual(await Booking.findById(fix.booking._id).lean(), before);
    const lookup = await request(lookupPath(codes[0], fix.showtime), employee);
    assert.equal(lookup.status, 200);
    assert.equal(lookup.data.eligible, true);
    assert.deepEqual(await Booking.findById(fix.booking._id).lean(), before);
    const checkIn = await request(checkPath(codes[0]), employee, 'POST', { showtimeId: fix.showtime._id });
    assert.equal(checkIn.status, 200);
    assert.equal(checkIn.data.admissionGranted, true);
    const stored = await Booking.findById(fix.booking._id);
    assert.deepEqual(stored.tickets.map(ticket => ticket.code), codes);
    assert.equal(stored.tickets[1].status, 'checked-in');
    assert.equal(stored.tickets[0].qr, paid.data.tickets[0].qr);
    assert.equal(stored.tickets[0].reference, codes[0]);
    assert.equal(stored.tickets[0].status, 'checked-in');
    assert.equal(String(stored.tickets[0].checkedInBy), employee.id);
    await PaymentAttempt.updateOne({ booking: fix.booking._id }, { $set: { amount: 1 } });
    assert.deepEqual((await issue(fix)).tickets, []);
    assert.equal((await request(lookupPath(codes[0], fix.showtime), employee)).data.eligible, false);
  });

  await t.test('cookie-authenticated check-in rejects cross-origin and non-JSON writes', async () => {
    const fix = await fixture(), ref = (await issue(fix)).tickets[0].reference;
    assert.equal((await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id }, { Origin: 'https://other.test' })).status, 403);
    assert.equal((await request(checkPath(ref), employee, 'POST', { showtimeId: fix.showtime._id }, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await Booking.findById(fix.booking._id)).tickets[0].status, 'issued');
  });
});
