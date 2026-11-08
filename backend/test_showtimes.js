import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from './src/app.js';
import Movie from './src/models/Movie.js';
import Showtime from './src/models/Showtime.js';
import Booking from './src/models/Booking.js';
import User from './src/models/User.js';
import CinemaRoom from './src/models/CinemaRoom.js';
import { createBooking } from './src/services/bookingService.js';

test('UC-17.1–17.4 Admin showtime management', async (t) => {
  const dbName = `booking_cinema_showtimes_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', {
    dbName, serverSelectionTimeoutMS: 5000
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const admin = await User.create({ fullName: 'Showtime Admin', email: 'admin@showtimes.test', password: randomUUID(), role: 'admin' });
  const member = await User.create({ fullName: 'Showtime Member', email: 'member@showtimes.test', password: randomUUID(), role: 'member', status: 'Active' });
  const employee = await User.create({ fullName: 'Showtime Employee', email: 'employee@showtimes.test', password: randomUUID(), role: 'employee' });
  const movie = await Movie.create({ title: 'Showtime Test Movie', duration: 120, classification: 'P' });
  const otherMovie = await Movie.create({ title: 'Another Movie', duration: 90, classification: 'T13' });
  const restrictedMovie = await Movie.create({ title: 'Restricted Movie', duration: 90, classification: 'C' });
  const layout = [];
  for (const row of ['A', 'B', 'C', 'D', 'E']) {
    for (let number = 1; number <= 8; number++) layout.push(row + number);
  }
  for (const name of ['Room 1', 'Room 2', 'Room 3', 'Failure Room', 'Concurrent Room', 'Race Room']) {
    await CinemaRoom.create({ cinema: 'Test Cinema', name, status: 'Active', seats: layout });
  }
  await CinemaRoom.create({ cinema: 'Other Cinema', name: 'Room 1', status: 'Active', seats: layout });
  const start = new Date();
  start.setUTCFullYear(start.getUTCFullYear() + 1);
  start.setUTCHours(3, 0, 0, 0);
  function time(minutes = 0) { return new Date(start.getTime() + minutes * 60000).toISOString(); }
  const valid = { movie: String(movie._id), cinema: 'Test Cinema', room: 'Room 1', startTime: time(), price: 80000 };
  async function request(path = '/showtimes', method = 'GET', body, user = admin, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (user) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302', { expiresIn: '5m' });
      headers.Cookie = `token=${token}`;
    }
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  let created;
  await t.test('all four operations require an active Admin session', async () => {
    for (const user of [null, member, employee]) {
      for (const [method, path] of [['GET', '/showtimes'], ['POST', '/showtimes'], ['PUT', `/showtimes/${movie._id}`], ['DELETE', `/showtimes/${movie._id}`]]) {
        assert.equal((await request(path, method, method === 'GET' ? undefined : valid, user)).status, user ? 403 : 401);
      }
    }
    await User.updateOne({ _id: admin._id }, { status: 'Inactive' });
    assert.equal((await request()).status, 401);
    await User.updateOne({ _id: admin._id }, { status: 'Active' });
  });
  await t.test('empty list and invalid pagination/filter', async () => {
    assert.deepEqual((await request()).data, { showtimes: [], total: 0, page: 1, totalPages: 0 });
    for (const query of ['page=-1', 'page=1.5', 'limit=51', 'movie=bad', 'movie[x]=bad']) {
      assert.equal((await request(`/showtimes?${query}`)).status, 400);
    }
  });
  await t.test('upcoming shows precede history across pages; equal times and movie filters stay stable', async () => {
    const now = Date.now();
    const fixture = { cinema: valid.cinema, room: valid.room, price: 80000, movie: movie._id };
    const shows = await Showtime.insertMany([
      { ...fixture, startTime: new Date(now - 120 * 60000) },
      { ...fixture, startTime: new Date(now + 60 * 60000) },
      { ...fixture, startTime: new Date(now + 30 * 60000) },
      { ...fixture, startTime: new Date(now - 60 * 60000) },
      { ...fixture, startTime: new Date(now + 30 * 60000) },
      { ...fixture, movie: otherMovie._id, startTime: new Date(now + 15 * 60000) }
    ]);
    const ids = shows.map(show => String(show._id));
    try {
      const seen = [];
      for (let page = 1; page <= 3; page++) {
        const response = await request(`/showtimes?movie=${movie._id}&limit=2&page=${page}`);
        assert.equal(response.status, 200);
        assert.equal(response.data.total, 5);
        assert.equal(response.data.totalPages, 3);
        for (const show of response.data.showtimes) seen.push(show._id);
      }
      assert.deepEqual(seen, [ids[2], ids[4], ids[1], ids[3], ids[0]]);
      assert.equal(new Set(seen).size, 5);
      const first = await request('/showtimes?limit=3&page=1');
      const second = await request('/showtimes?limit=3&page=2');
      assert.deepEqual(first.data.showtimes.map(show => show._id), [ids[5], ids[2], ids[4]]);
      assert.deepEqual(second.data.showtimes.map(show => show._id), [ids[1], ids[3], ids[0]]);
      assert.deepEqual((await request(`/showtimes?movie=${movie._id}&limit=2&page=4`)).data.showtimes, []);
      // With no upcoming screenings, history still shows the most recent first.
      await Showtime.deleteMany({ _id: { $in: [shows[1]._id, shows[2]._id, shows[4]._id] } });
      const history = await request(`/showtimes?movie=${movie._id}`);
      assert.deepEqual(history.data.showtimes.map(show => show._id), [ids[3], ids[0]]);
    } finally {
      await Showtime.deleteMany({ _id: { $in: shows.map(show => show._id) } });
    }
  });
  await t.test('create copies the configured room layout and ignores injected seat states', async () => {
    const result = await request('/showtimes', 'POST', { ...valid, cinema: ' Test Cinema ', seats: [{ number: 'X1', status: 'booked' }] });
    assert.equal(result.status, 201);
    created = result.data.showtime;
    assert.equal(created.cinema, valid.cinema);
    assert.equal(created.seats.length, 40);
    assert.equal(created.seats[0].number, 'A1');
    assert.equal(created.seats[39].number, 'E8');
    assert.ok(created.seats.every((seat) => seat.status === 'available'));
    assert.ok(created.roomId);
    const publicList = await request('/movies/showtimes');
    assert.ok(publicList.data.some((showtime) => showtime._id === created._id));
  });
  await t.test('room catalogue and current showtime details require Admin and hide booking references', async () => {
    for (const user of [null, member, employee]) {
      for (const path of ['/showtimes/rooms', `/showtimes/${created._id}`]) {
        assert.equal((await request(path, 'GET', undefined, user)).status, user ? 403 : 401);
      }
    }
    const rooms = await request('/showtimes/rooms');
    assert.equal(rooms.status, 200);
    assert.equal(rooms.data.length, 7);
    const detail = await request(`/showtimes/${created._id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.movie.title, movie.title);
    assert.equal(detail.data.seats[0].bookingId, undefined);
    assert.equal((await request('/showtimes/bad')).status, 400);
    assert.equal((await request(`/showtimes/${new mongoose.Types.ObjectId()}`)).status, 404);
  });
  await t.test('rejects nonexistent, inactive and invalid-layout rooms and deleted movies', async () => {
    assert.equal((await request('/showtimes', 'POST', { ...valid, room: 'Missing Room' })).status, 400);
    const room = await CinemaRoom.create({ cinema: valid.cinema, name: 'Closed Room', status: 'Maintenance', seats: ['B1'] });
    assert.equal((await request('/showtimes', 'POST', { ...valid, room: room.name })).status, 409);
    await CinemaRoom.collection.updateOne({ _id: room._id }, { $set: { status: 'Active', seats: ['B1', 'B1'] } });
    assert.equal((await request('/showtimes', 'POST', { ...valid, room: room.name })).status, 409);
    await CinemaRoom.collection.updateOne({ _id: room._id }, { $set: { seats: [] } });
    assert.equal((await request('/showtimes', 'POST', { ...valid, room: room.name })).status, 409);
    await CinemaRoom.deleteOne({ _id: room._id });
    const deleted = await Movie.create({ title: 'Removed Movie', duration: 90, deletedAt: new Date() });
    assert.equal((await request('/showtimes', 'POST', { ...valid, movie: String(deleted._id) })).status, 404);
  });
  await t.test('custom layouts are copied on create and changed only for unbooked screenings', async () => {
    const custom = await CinemaRoom.create({ cinema: valid.cinema, name: 'Custom Room', status: 'Active', seats: ['C1', 'C2', 'D1'] });
    const result = await request('/showtimes', 'POST', { ...valid, room: custom.name });
    assert.equal(result.status, 201);
    const screening = result.data.showtime;
    assert.deepEqual(screening.seats.map((seat) => seat.number), custom.seats.toObject());
    const response = await request(`/showtimes/${screening._id}`, 'PUT', {
      ...valid, room: custom.name, updatedAt: screening.updatedAt, startTime: time(300)
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.data.showtime.seats, screening.seats);
    const moved = await request(`/showtimes/${screening._id}`, 'PUT', {
      ...valid, room: 'Room 2', updatedAt: response.data.showtime.updatedAt, startTime: time(300)
    });
    assert.equal(moved.status, 200);
    assert.equal(moved.data.showtime.seats.length, 40);
    await CinemaRoom.updateOne({ _id: custom._id }, { status: 'Inactive' });
    assert.equal((await request(`/showtimes/${screening._id}`, 'PUT', {
      ...valid, room: custom.name, updatedAt: moved.data.showtime.updatedAt
    })).status, 409);
    assert.equal((await Showtime.findById(screening._id)).room, 'Room 2');
    await Showtime.deleteOne({ _id: screening._id });
    await CinemaRoom.deleteOne({ _id: custom._id });
  });
  await t.test('explicit room import validates first and never overwrites existing room configurations', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cinema-rooms-test-'));
    const filename = join(directory, 'rooms.json');
    const uri = new URL(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema');
    uri.pathname = '/' + dbName;
    const run = promisify(execFile);
    const options = { env: { ...process.env, MONGODB_URI: uri.toString() } };
    const script = fileURLToPath(new URL('./importRooms.js', import.meta.url));
    const imported = { cinema: 'Import Cinema', name: 'Room 1', status: 'Active', seats: ['F1', 'F2'] };
    try {
      await writeFile(filename, JSON.stringify([imported, { ...imported, name: 'Invalid', seats: ['F1', 'F1'] }]));
      await assert.rejects(run(process.execPath, [script, filename], options));
      assert.equal(await CinemaRoom.countDocuments({ cinema: imported.cinema }), 0);
      await writeFile(filename, JSON.stringify([imported]));
      await run(process.execPath, [script, filename], options);
      await writeFile(filename, JSON.stringify([{ ...imported, status: 'Inactive', seats: ['G1'] }]));
      await run(process.execPath, [script, filename], options);
      const saved = await CinemaRoom.findOne({ cinema: imported.cinema });
      assert.equal(saved.status, 'Active');
      assert.deepEqual(saved.seats.toObject(), imported.seats);
      assert.equal(await CinemaRoom.countDocuments({ cinema: imported.cinema }), 1);
    } finally {
      await CinemaRoom.deleteMany({ cinema: imported.cinema });
      await unlink(filename);
      await rmdir(directory);
    }
  });
  await t.test('missing, malformed, past, unavailable and restricted data are rejected', async () => {
    const invalid = [{}, { movie: 'bad' }, { cinema: '' }, { cinema: { $ne: '' } }, { room: ' ' },
      { price: 0 }, { price: -1 }, { price: 1.5 }, { price: '80000' }, { startTime: 'bad' },
      { startTime: '2020-01-01T00:00:00Z' }, { startTime: `${start.getUTCFullYear()}-02-30T12:00:00Z` },
      { startTime: `${start.getUTCFullYear()}-12-01T24:00:00Z` }, { movie: String(restrictedMovie._id) }];
    for (const input of invalid) {
      const body = Object.keys(input).length ? { ...valid, ...input } : {};
      assert.equal((await request('/showtimes', 'POST', body)).status, 400, JSON.stringify(input));
    }
    assert.equal((await request('/showtimes', 'POST', { ...valid, movie: String(new mongoose.Types.ObjectId()) })).status, 404);
    assert.equal(await Showtime.countDocuments(), 1);
  });
  await t.test('overlap checks both directions, different movies, cleaning buffer and room names', async () => {
    for (const offset of [-104, -30, 0, 120, 134]) {
      assert.equal((await request('/showtimes', 'POST', {
        ...valid, movie: String(otherMovie._id), cinema: 'test cinema', room: 'room 1', startTime: time(offset)
      })).status, 409, `offset ${offset}`);
    }
    for (const offset of [-105, 135]) {
      assert.equal((await request('/showtimes', 'POST', { ...valid, movie: String(otherMovie._id), startTime: time(offset) })).status, 201);
    }
    assert.equal((await request('/showtimes', 'POST', { ...valid, room: 'Room 2' })).status, 201);
    assert.equal((await request('/showtimes', 'POST', { ...valid, cinema: 'Other Cinema' })).status, 201);
  });
  await t.test('list supports pagination, movie filter, populated details and hides booking identifiers', async () => {
    const first = (await request('/showtimes?limit=1')).data;
    const second = (await request('/showtimes?limit=1&page=2')).data;
    assert.equal(first.total, 5);
    assert.notEqual(first.showtimes[0]._id, second.showtimes[0]._id);
    assert.ok(first.showtimes[0].movie.title);
    assert.equal(first.showtimes[0].seats[0].bookingId, undefined);
    assert.equal((await request(`/showtimes?movie=${otherMovie._id}`)).data.total, 2);
  });
  await t.test('update saves allowed fields, preserves seats and rejects stale edits and overlap', async () => {
    const path = `/showtimes/${created._id}`;
    assert.equal((await request(path, 'PUT', { ...valid, updatedAt: created.updatedAt, startTime: time(135) })).status, 409);
    const result = await request(path, 'PUT', { ...valid, updatedAt: created.updatedAt, price: 95000, room: 'Room 3', seats: [] });
    assert.equal(result.status, 200);
    assert.equal(result.data.showtime.price, 95000);
    assert.deepEqual(result.data.showtime.seats, created.seats);
    assert.equal((await request(path, 'PUT', { ...valid, updatedAt: created.updatedAt })).status, 409);
    assert.equal((await request(path, 'DELETE', { updatedAt: created.updatedAt })).status, 409);
    created = result.data.showtime;
    const publicResult = (await request('/movies/showtimes')).data.find((item) => item._id === created._id);
    assert.equal(publicResult.price, 95000);
  });
  await t.test('active holds, booked seats and all booking history block edit/delete', async () => {
    for (const status of ['held', 'booked']) {
      let current = await Showtime.findByIdAndUpdate(created._id, { $set: { 'seats.0.status': status } }, { new: true });
      for (const method of ['PUT', 'DELETE']) {
        assert.equal((await request(`/showtimes/${created._id}`, method, { ...valid, updatedAt: current.updatedAt.toISOString() })).status, 409);
      }
    }
    await Showtime.updateOne({ _id: created._id }, { $set: { 'seats.0.status': 'available' } });
    for (const status of ['pending', 'paid', 'cancelled']) {
      const booking = await Booking.create({ user: member._id, showtime: created._id, seats: ['A1'], subtotal: 80000, total: 80000, status });
      const current = await Showtime.findById(created._id);
      for (const method of ['PUT', 'DELETE']) {
        assert.equal((await request(`/showtimes/${created._id}`, method, { ...valid, updatedAt: current.updatedAt.toISOString() })).status, 409);
      }
      assert.ok(await Booking.findById(booking._id));
      await Booking.deleteOne({ _id: booking._id });
    }
  });
  await t.test('malformed/missing records and cross-origin writes fail safely', async () => {
    for (const method of ['PUT', 'DELETE']) {
      assert.equal((await request('/showtimes/bad', method, valid)).status, 400);
      assert.equal((await request(`/showtimes/${new mongoose.Types.ObjectId()}`, method, valid)).status, 404);
    }
    assert.equal((await request('/showtimes', 'POST', valid, admin, { Origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await request('/showtimes', 'POST', valid, admin, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  });
  await t.test('database errors return 500 without exposing internal details', async () => {
    const mock = t.mock.method(Showtime, 'countDocuments', async () => { throw new Error('Private database detail'); });
    try {
      const result = await request();
      assert.equal(result.status, 500);
      assert.ok(!result.data.message.includes('Private database detail'));
    } finally { mock.mock.restore(); }
  });
  await t.test('failed writes leave the database unchanged and do not block later writes', async () => {
    const count = await Showtime.countDocuments();
    const mock = t.mock.method(Showtime, 'create', async () => { throw new Error('Private write failure'); });
    try {
      assert.equal((await request('/showtimes', 'POST', { ...valid, room: 'Failure Room' })).status, 500);
      assert.equal(await Showtime.countDocuments(), count);
    } finally { mock.mock.restore(); }
  });
  await t.test('update and delete database failures preserve the record and release the schedule guard', async () => {
    for (const [method, operation] of [['PUT', 'findOneAndUpdate'], ['DELETE', 'findOneAndDelete']]) {
      const current = await Showtime.findById(created._id);
      const mock = t.mock.method(Showtime, operation, async () => { throw new Error('Private save failure'); });
      try {
        const result = await request(`/showtimes/${created._id}`, method, {
          ...valid, room: current.room, updatedAt: current.updatedAt.toISOString()
        });
        assert.equal(result.status, 500);
        assert.ok(!result.data.message.includes('Private save failure'));
        assert.deepEqual((await Showtime.findById(created._id)).toObject(), current.toObject());
      } finally { mock.mock.restore(); }
    }
  });
  await t.test('simultaneous Admin requests cannot insert overlapping showtimes', async () => {
    const body = { ...valid, room: 'Concurrent Room' };
    const responses = await Promise.all([request('/showtimes', 'POST', body), request('/showtimes', 'POST', body)]);
    assert.deepEqual(responses.map((item) => item.status).sort(), [201, 409]);
    assert.equal(await Showtime.countDocuments({ room: 'Concurrent Room' }), 1);
    await Showtime.deleteMany({ room: 'Concurrent Room' });
  });
  await t.test('a seat claimed after validation prevents the Admin write', async () => {
    const current = await Showtime.findById(created._id);
    const original = Showtime.findOneAndUpdate;
    const mock = t.mock.method(Showtime, 'findOneAndUpdate', async function (filter, update, options) {
      await Showtime.updateOne({ _id: created._id }, { $set: { 'seats.0.status': 'held' } });
      return original.call(Showtime, filter, update, options);
    });
    try {
      assert.equal((await request(`/showtimes/${created._id}`, 'PUT', {
        ...valid, room: 'Race Room', updatedAt: current.updatedAt.toISOString()
      })).status, 409);
      assert.equal((await Showtime.findById(created._id)).room, 'Room 3');
    } finally {
      mock.mock.restore();
      await Showtime.updateOne({ _id: created._id }, { $set: { 'seats.0.status': 'available' } });
    }
  });
  await t.test('booking rejects a price changed just before seat claim, and normal booking still works', async () => {
    const original = Showtime.updateOne;
    const mock = t.mock.method(Showtime, 'updateOne', async function (filter, update, options) {
      if (filter.$and) {
        await original.call(Showtime, { _id: created._id }, { $set: { price: 100000 } });
      }
      return original.call(Showtime, filter, update, options);
    });
    try {
      await assert.rejects(createBooking({ userId: member._id, showtimeId: created._id, seats: ['A1'] }), { status: 409 });
      assert.equal(await Booking.countDocuments({ showtime: created._id }), 0);
      assert.equal((await Showtime.findById(created._id)).seats[0].status, 'available');
    } finally { mock.mock.restore(); }
    const booking = await createBooking({ userId: member._id, showtimeId: created._id, seats: ['A1'] });
    assert.equal(booking.total, 100000);
    const current = await Showtime.findById(created._id);
    assert.equal((await request(`/showtimes/${created._id}`, 'DELETE', { updatedAt: current.updatedAt.toISOString() })).status, 409);
    await Booking.deleteOne({ _id: booking._id });
    await Showtime.updateOne({ _id: created._id }, { $set: {
      'seats.0.status': 'available', 'seats.0.bookingId': null, 'seats.0.holdUntil': null
    } });
  });
  await t.test('started showtimes cannot be edited or deleted', async () => {
    const past = await Showtime.create({ ...valid, room: 'Past Room', startTime: new Date('2020-01-01') });
    for (const method of ['PUT', 'DELETE']) {
      assert.equal((await request(`/showtimes/${past._id}`, method, { ...valid, updatedAt: past.updatedAt.toISOString() })).status, 409);
    }
    await Showtime.deleteOne({ _id: past._id });
  });
  await t.test('delete removes only the unbooked record and public schedule reflects removal', async () => {
    const current = await Showtime.findById(created._id);
    assert.equal((await request(`/showtimes/${created._id}`, 'DELETE', { updatedAt: current.updatedAt.toISOString() })).status, 200);
    assert.equal(await Showtime.findById(created._id), null);
    assert.equal(await Showtime.countDocuments(), 4);
    assert.ok(!(await request('/movies/showtimes')).data.some((item) => item._id === created._id));
  });
});
