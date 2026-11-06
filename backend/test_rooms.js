import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from './src/app.js';
import CinemaRoom from './src/models/CinemaRoom.js';
import Showtime from './src/models/Showtime.js';
import Movie from './src/models/Movie.js';
import Booking from './src/models/Booking.js';
import User from './src/models/User.js';
import { createBooking, settle } from './src/services/bookingService.js';

test('UC-14 rooms, UC-14.1 seats and operational seat conditions', async t => {
  const dbName = 'cinema_rooms_test_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    try { await mongoose.connection.dropDatabase(); } finally { await mongoose.disconnect(); }
  });
  await CinemaRoom.init();
  const users = {};
  for (const role of ['admin', 'member', 'employee']) users[role] = await User.create({ fullName: 'Room Test ' + role, email: `${role}@rooms.test`, password: randomUUID(), role, status: 'Active' });
  const movie = await Movie.create({ title: 'Rooms Test Movie', duration: 100, classification: 'P' });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, method = 'GET', body, user = users.admin, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (user) headers.Cookie = 'token=' + jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302', { expiresIn: '5m' });
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  async function create(extra = {}) {
    const response = await request('/rooms', 'POST', { cinema: 'Test Cinema', name: randomUUID(), seats: ['A1', 'A2', 'B1', 'B2'], ...extra });
    assert.equal(response.status, 201, JSON.stringify(response.data));
    return response.data.room;
  }
  async function room(id) { return (await request('/rooms/' + id)).data; }
  async function layout(current, configs, seats = current.seats) {
    return request(`/rooms/${current._id}/seats`, 'PUT', { version: current.version, seats, seatConfigs: configs, confirmed: true });
  }
  async function showtime(current, offset = 0) {
    const response = await request('/showtimes', 'POST', { movie: String(movie._id), cinema: current.cinema, room: current.name,
      startTime: new Date(Date.now() + 3600000 + offset).toISOString(), price: 80000 });
    assert.equal(response.status, 201, JSON.stringify(response.data));
    return response.data.showtime;
  }

  await t.test('all room/seat endpoints require an active Admin and writes check Origin and JSON', async () => {
    const id = new mongoose.Types.ObjectId();
    for (const user of [null, users.member, users.employee]) {
      for (const [method, path] of [['GET', '/rooms'], ['GET', `/rooms/${id}`], ['GET', `/rooms/${id}/seats`], ['POST', '/rooms'], ['PUT', `/rooms/${id}`], ['DELETE', `/rooms/${id}`], ['PUT', `/rooms/${id}/seats`], ['POST', `/rooms/${id}/seats/preview`]]) {
        assert.equal((await request(path, method, method === 'GET' ? undefined : {}, user)).status, user ? 403 : 401);
      }
    }
    assert.equal((await request('/rooms', 'POST', {}, users.admin, { Origin: 'https://untrusted.invalid' })).status, 403);
    assert.equal((await request('/rooms', 'POST', {}, users.admin, { 'Content-Type': 'text/plain' })).status, 415);
  });
  await t.test('create defaults to Inactive with derived capacity and legacy seat defaults', async () => {
    const created = await create({ name: 'Room 01' });
    assert.equal(created.status, 'Inactive'); assert.equal(created.capacity, 4);
    assert.deepEqual(created.seatConfigs.A1, { type: 'Standard', status: 'Active' });
    const saved = await CinemaRoom.findById(created._id).select('+lastModifiedBy');
    assert.equal(String(saved.lastModifiedBy), String(users.admin._id));
    assert.equal(saved.get('capacity'), undefined);
  });
  await t.test('room name uniqueness ignores case within a cinema but permits another cinema', async () => {
    assert.equal((await request('/rooms', 'POST', { cinema: 'test cinema', name: 'room 01', seats: ['A1'] })).status, 409);
    await create({ cinema: 'Other Cinema', name: 'Room 01' });
  });
  await t.test('new rooms accept only Active/Inactive; Maintenance remains available when editing existing rooms', async () => {
    const before = await CinemaRoom.countDocuments();
    const rejected = await request('/rooms', 'POST', { cinema: 'Test Cinema', name: 'Maintenance creation', seats: ['A1'], status: 'Maintenance' });
    assert.equal(rejected.status, 400);
    assert.equal(await CinemaRoom.countDocuments(), before);
    const current = await create({ status: 'Active' });
    const edited = await request('/rooms/' + current._id, 'PUT', { ...current, status: 'Maintenance' });
    assert.equal(edited.status, 200);
    assert.equal((await room(current._id)).status, 'Maintenance');
  });
  await t.test('search, cinema/status filters and pagination read persisted rooms', async () => {
    const found = await request('/rooms?search=Room%2001&cinema=TEST%20CINEMA&status=Inactive&limit=1');
    assert.equal(found.status, 200); assert.equal(found.data.total, 1); assert.equal(found.data.rooms[0].name, 'Room 01');
    assert.equal((await request('/rooms?search=%2E%2A')).data.total, 0);
    for (const query of ['page=0', 'limit=51', 'status=bad', 'search[x]=a']) assert.equal((await request('/rooms?' + query)).status, 400);
    assert.equal((await request('/rooms/invalid')).status, 400);
    assert.equal((await request('/rooms/' + new mongoose.Types.ObjectId())).status, 404);
  });
  await t.test('invalid status, empty/duplicate/invalid seats and invalid/orphan metadata are rejected', async () => {
    for (const extra of [{ status: 'bad' }, { seats: [] }, { seats: ['A1', 'A1'] }, { seats: ['a1'] }, { seats: ['A0'] }, { seats: ['A1'], seatConfigs: { A2: { type: 'VIP', status: 'Active' } } },
      { seatConfigs: { A1: { type: 'Couple', status: 'Active' } } }, { seatConfigs: { A1: { type: 'VIP', status: 'booked' } } }, { seatConfigs: [] }]) {
      assert.equal((await request('/rooms', 'POST', { cinema: 'Test', name: randomUUID(), seats: ['A1'], ...extra })).status, 400);
    }
    await assert.rejects(new CinemaRoom({ cinema: 'Test', name: 'Invalid metadata', seats: ['A1'], seatConfigs: { A2: { type: 'VIP' } } }).validate());
  });
  await t.test('seat condition transitions, VIP type and bulk changes persist without prices', async () => {
    let current = await create();
    for (const status of ['Broken', 'Maintenance', 'Active', 'Disabled', 'Active']) {
      const configs = { ...current.seatConfigs, A1: { type: 'Standard', status } };
      const saved = await layout(current, configs); assert.equal(saved.status, 200); current = saved.data.room;
      assert.equal((await room(current._id)).seatConfigs.A1.status, status);
    }
    const configs = { ...current.seatConfigs, A1: { type: 'VIP', status: 'Active' }, A2: { type: 'VIP', status: 'Maintenance' } };
    const saved = await layout(current, configs); assert.equal(saved.status, 200);
    assert.equal(saved.data.room.seatConfigs.A1.type, 'VIP'); assert.equal(saved.data.room.seatConfigs.A2.status, 'Maintenance');
    assert.equal('price' in saved.data.room, false);
  });
  await t.test('preview reports added, removed, type and condition changes without saving', async () => {
    const current = await create();
    const configs = { A1: { type: 'VIP', status: 'Broken' }, B1: current.seatConfigs.B1, B2: current.seatConfigs.B2, C1: { type: 'Standard', status: 'Active' } };
    const body = { version: current.version, seats: ['A1', 'B1', 'B2', 'C1'], seatConfigs: configs };
    const response = await request(`/rooms/${current._id}/seats/preview`, 'POST', body);
    assert.equal(response.status, 200); assert.deepEqual(response.data.review.added, ['C1']); assert.deepEqual(response.data.review.removed, ['A2']);
    assert.equal(response.data.review.types[0].seat, 'A1'); assert.equal(response.data.review.conditions[0].seat, 'A1');
    assert.equal(response.data.review.canSave, true); assert.equal((await room(current._id)).version, current.version);
    assert.equal((await request(`/rooms/${current._id}/seats`, 'PUT', body)).status, 400);
  });
  await t.test('room information updates and two stale Admin writes produce one winner', async () => {
    const current = await create();
    const payload = { cinema: current.cinema, name: current.name, status: 'Active', version: current.version };
    const results = await Promise.all([request('/rooms/' + current._id, 'PUT', payload), request('/rooms/' + current._id, 'PUT', payload)]);
    assert.deepEqual(results.map(value => value.status).sort(), [200, 409]);
    assert.equal((await room(current._id)).version, 1);
  });
  await t.test('safe room deletion removes only an unreferenced room', async () => {
    const current = await create();
    assert.equal((await request('/rooms/' + current._id, 'DELETE', { version: current.version })).status, 200);
    assert.equal((await request('/rooms/' + current._id)).status, 404);
  });
  await t.test('legacy room metadata defaults and legacy showtime string references remain protected', async () => {
    const legacy = await CinemaRoom.collection.insertOne({ cinema: 'Legacy Cinema', name: 'Legacy Room', status: 'Active', seats: ['AA1', 'AA2'] });
    const current = await room(legacy.insertedId);
    assert.deepEqual(current.seatConfigs.AA1, { type: 'Standard', status: 'Active' });
    const show = await Showtime.create({ movie: movie._id, cinema: 'legacy cinema', room: 'legacy room', price: 70000, startTime: new Date(Date.now() + 3600000), seats: [{ number: 'AA1', status: 'booked' }, { number: 'AA2' }] });
    const configs = { ...current.seatConfigs, AA1: { type: 'VIP', status: 'Broken' } };
    assert.equal((await layout(current, configs)).status, 409);
    assert.equal((await request('/rooms/' + current._id, 'DELETE', { version: current.version })).status, 409);
    const saved = await Showtime.findById(show._id); assert.equal(saved.price, 70000); assert.equal(saved.seats[0].status, 'booked');
  });
  await t.test('showtimes snapshot type/condition and backend rejects all non-Active seat conditions', async () => {
    let current = await create({ status: 'Active' });
    const configs = { A1: { type: 'VIP', status: 'Active' }, A2: { type: 'Standard', status: 'Broken' }, B1: { type: 'Standard', status: 'Maintenance' }, B2: { type: 'VIP', status: 'Disabled' } };
    current = (await layout(current, configs)).data.room;
    const show = await showtime(current);
    assert.equal(show.seats[0].type, 'VIP'); assert.equal(show.seats[1].condition, 'Broken');
    assert.equal(show.seats[1].status, 'available');
    for (const number of ['A2', 'B1', 'B2']) await assert.rejects(createBooking({ userId: users.member._id, showtimeId: show._id, seats: [number] }), { status: 409 });
    assert.equal(await Booking.countDocuments({ showtime: show._id }), 0);
    const b = await createBooking({ userId: users.member._id, showtimeId: show._id, seats: ['A1'] });
    assert.equal(b.ticketPrice, 80000); assert.equal(b.total, 80000);
  });
  await t.test('active holds block edits and deletes, and save rechecks references after preview', async () => {
    const current = await create({ status: 'Active' });
    const show = await showtime(current);
    const configs = { ...current.seatConfigs, A1: { type: 'VIP', status: 'Broken' } };
    const payload = { version: current.version, seats: current.seats, seatConfigs: configs };
    assert.equal((await request(`/rooms/${current._id}/seats/preview`, 'POST', payload)).data.review.canSave, true);
    await createBooking({ userId: users.member._id, showtimeId: show._id, seats: ['A1'] });
    assert.equal((await layout(current, configs)).status, 409);
    const blocked = await request(`/rooms/${current._id}/seats/preview`, 'POST', payload);
    assert.equal(blocked.data.review.canSave, false); assert.ok(blocked.data.review.conflicts[0].includes('A1'));
    assert.equal((await request('/rooms/' + current._id, 'DELETE', { version: current.version })).status, 409);
    assert.equal((await room(current._id)).version, current.version);
  });
  await t.test('paid bookings protect seats even with inconsistent legacy seat flags; no booking PII leaks', async () => {
    const current = await create({ status: 'Active' });
    const show = await showtime(current);
    await Booking.create({ user: users.member._id, showtime: show._id, seats: ['B1'], subtotal: 80000, total: 80000, status: 'paid', paymentStatus: 'paid' });
    const configs = { ...current.seatConfigs, B1: { type: 'Standard', status: 'Disabled' } };
    assert.equal((await layout(current, configs)).status, 409);
    const data = (await request(`/rooms/${current._id}/seats/preview`, 'POST', { version: current.version, seats: current.seats, seatConfigs: configs })).data;
    assert.equal(JSON.stringify(data).includes(users.member.email), false); assert.equal(JSON.stringify(data).includes(String(users.member._id)), false);
  });
  await t.test('paid settlement survives a safe future layout addition and keeps accepted prices', async () => {
    const current = await create({ status: 'Active' });
    const show = await showtime(current);
    const b = await createBooking({ userId: users.member._id, showtimeId: show._id, seats: ['A1'] });
    const paid = await settle(b._id, { kind: 'cash', actor: users.employee._id, receivedAmount: 80000 });
    assert.equal(paid.status, 'paid');
    const before = JSON.stringify(await Showtime.findById(show._id).lean());
    const configs = { ...current.seatConfigs, C1: { type: 'VIP', status: 'Active' } };
    assert.equal((await layout(current, configs, [...current.seats, 'C1'])).status, 200);
    assert.equal(JSON.stringify(await Showtime.findById(show._id).lean()), before);
    assert.equal((await Booking.findById(b._id)).ticketPrice, 80000);
    assert.equal((await Booking.findById(b._id)).total, 80000);
  });
  await t.test('existing unbooked snapshots remain unchanged; only newly created showtimes use new metadata', async () => {
    const current = await create({ status: 'Active' });
    const old = await showtime(current);
    const before = JSON.stringify(await Showtime.findById(old._id).lean());
    const configs = { ...current.seatConfigs, A2: { type: 'VIP', status: 'Broken' } };
    const updated = (await layout(current, configs)).data.room;
    assert.equal(JSON.stringify(await Showtime.findById(old._id).lean()), before);
    const next = await showtime(updated, 4 * 3600000);
    assert.equal(next.seats.find(seat => seat.number === 'A2').condition, 'Broken');
    assert.equal((await request('/showtimes', 'POST', { movie: String(movie._id), cinema: current.cinema, room: current.name, startTime: old.startTime, price: 90000 })).status, 409);
  });
  await t.test('scheduled/in-progress room cannot be renamed, disabled or deleted; inactive rooms cannot schedule', async () => {
    const current = await create({ status: 'Active' });
    const show = await showtime(current);
    await Showtime.updateOne({ _id: show._id }, { startTime: new Date(Date.now() - 60000) });
    for (const changes of [{ name: 'Renamed' }, { cinema: 'New Cinema' }, { status: 'Maintenance' }, { status: 'Inactive' }]) {
      assert.equal((await request('/rooms/' + current._id, 'PUT', { ...current, ...changes })).status, 409);
    }
    const inactive = await create();
    assert.equal((await request('/showtimes', 'POST', { movie: String(movie._id), cinema: inactive.cinema, room: inactive.name, startTime: new Date(Date.now() + 3600000).toISOString(), price: 80000 })).status, 409);
    assert.equal((await request('/showtimes/rooms')).data.some(value => value._id === inactive._id), false);
  });
  await t.test('unreferenced inactive room status change refreshes scheduling catalogue', async () => {
    const current = await create();
    assert.equal((await request('/rooms/' + current._id, 'PUT', { ...current, status: 'Active' })).status, 200);
    assert.ok((await request('/showtimes/rooms')).data.some(value => value._id === current._id));
    const fresh = await room(current._id);
    assert.equal((await request('/rooms/' + current._id, 'PUT', { ...fresh, status: 'Maintenance' })).status, 200);
    assert.equal((await request('/showtimes/rooms')).data.some(value => value._id === current._id), false);
  });
  await t.test('database write failure preserves room and later writes release the shared guard', async () => {
    const current = await create();
    const mock = t.mock.method(CinemaRoom, 'findOneAndUpdate', () => { throw new Error('Private room write failure'); });
    try { assert.equal((await layout(current, { ...current.seatConfigs, A1: { type: 'VIP', status: 'Active' } })).status, 500); }
    finally { mock.mock.restore(); }
    assert.equal((await room(current._id)).version, 0);
    assert.equal((await layout(current, current.seatConfigs)).status, 200);
  });
});
