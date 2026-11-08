import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from "../../src/app.js";
import User from "../../src/models/users/User.js";
import Movie from "../../src/models/movies/Movie.js";
import CinemaRoom from "../../src/models/cinema/CinemaRoom.js";
import Showtime from "../../src/models/cinema/Showtime.js";

test('automatic showtime suggestions and atomic confirmation', async (t) => {
  const dbName = 'cinema_suggestions_test_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27019/booking_cinema?replicaSet=cinemaLocal', {
    dbName, serverSelectionTimeoutMS: 5000
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/showtimes`;
  const admin = await User.create({ fullName: 'Suggestion Admin', email: 'admin@suggestions.test', role: 'admin', password: randomUUID() });
  const other = await User.create({ fullName: 'Other Admin', email: 'other@suggestions.test', role: 'admin', password: randomUUID() });
  const member = await User.create({ fullName: 'Member', email: 'member@suggestions.test', role: 'member', status: 'Active', password: randomUUID() });
  const employee = await User.create({ fullName: 'Employee', email: 'employee@suggestions.test', role: 'employee', password: randomUUID() });
  const movie = await Movie.create({ title: 'Schedule Movie', duration: 120, classification: 'P' });
  const shortMovie = await Movie.create({ title: 'Short Movie', duration: 1, classification: 'P' });
  const otherMovie = await Movie.create({ title: 'Existing Movie', duration: 90, classification: 'P' });
  const blockedMovie = await Movie.create({ title: 'Blocked Movie', duration: 120, classification: 'C' });
  const rooms = [];
  for (const name of ['Room 1', 'Room 2']) rooms.push(await CinemaRoom.create({ cinema: 'Test Cinema', name, status: 'Active', seats: ['A1', 'A2'], seatConfigs: { A2: { type: 'VIP', status: 'Broken' } } }));
  await CinemaRoom.create({ cinema: 'Test Cinema', name: 'Inactive Room', status: 'Inactive', seats: ['A1'] });
  await CinemaRoom.create({ cinema: 'Test Cinema', name: 'Unusable Room', status: 'Active', seats: ['A1'], seatConfigs: { A1: { type: 'Standard', status: 'Broken' } } });
  await CinemaRoom.create({ cinema: 'Other Cinema', name: 'Other Room', status: 'Active', seats: ['A1'] });
  function day(offset = 0) { return new Date(Date.now() + (7 + offset) * 86400000 + 7 * 3600000).toISOString().slice(0, 10); }
  const input = { movie: String(movie._id), cinema: 'Test Cinema', startDate: day(), endDate: day(2), openingTime: '09:00', closingTime: '23:00', price: 80000 };
  async function request(path = '/suggestions', body = input, user = admin, extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (user) headers.Cookie = 'token=' + jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302');
    const response = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  async function preview(body = input) {
    const response = await request('/suggestions', body);
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data;
  }
  async function existing(room, start, durationMovie = movie) {
    return Showtime.create({ movie: durationMovie._id, roomId: room._id, cinema: room.cinema, room: room.name,
      startTime: new Date(`${day()}T${start}:00+07:00`), price: 90000, seats: [{ number: 'A1' }] });
  }

  await t.test('both endpoints require an active Admin and JSON from the allowed origin', async () => {
    for (const user of [null, member, employee]) {
      assert.equal((await request('/suggestions', input, user)).status, user ? 403 : 401);
      assert.equal((await request('/suggestions/confirm', { token: 'invalid' }, user)).status, user ? 403 : 401);
    }
    assert.equal((await request('/suggestions', input, admin, { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await request('/suggestions', input, admin, { 'Content-Type': 'text/plain' })).status, 415);
  });
  await t.test('invalid dates, times, movie, price, room injection and oversized ranges are rejected', async () => {
    for (const body of [null, [], {}, { ...input, movie: 'invalid' }, { ...input, movie: {} },
      { ...input, room: 'Room 1' }, { ...input, cinema: {} }, { ...input, price: '80000' }, { ...input, price: 0 },
      { ...input, startDate: '2030-02-30' }, { ...input, startDate: '2020-01-01' }, { ...input, endDate: day(-1) },
      { ...input, endDate: day(31) }, { ...input, openingTime: '24:00' }, { ...input, closingTime: '09:00' },
      { ...input, openingTime: '9:00' }, { ...input, movie: String(blockedMovie._id) }]) {
      assert.equal((await request('/suggestions', body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await request('/suggestions', { ...input, movie: String(new mongoose.Types.ObjectId()) })).status, 404);
    assert.equal((await request('/suggestions', { ...input, cinema: 'Missing Cinema' })).status, 409);
    assert.equal((await request('/suggestions', { ...input, movie: String(shortMovie._id), openingTime: '00:00', closingTime: '23:59' })).status, 400);
    const upcoming = await Movie.create({ title: 'Upcoming', duration: 120, releaseDate: new Date(day(3)) });
    assert.equal((await request('/suggestions', { ...input, movie: String(upcoming._id) })).status, 400);
    assert.equal(await Showtime.countDocuments(), 0);
  });
  await t.test('preview matches the reference: 3 days, 6 slots/day, automatic balanced rooms and no writes', async () => {
    const result = await preview();
    assert.equal(result.total, 18);
    assert.equal(result.days.length, 3);
    assert.equal(result.days[0].slots.length, 6);
    assert.equal(result.days[0].slots[0].room, 'Room 1');
    assert.equal(result.days[0].slots[1].room, 'Room 2');
    assert.equal(result.days[0].slots[0].startTime, new Date(`${day()}T09:00:00+07:00`).toISOString());
    assert.equal(result.days[0].slots[5].endTime, new Date(`${day()}T22:15:00+07:00`).toISOString());
    assert.equal(result.timezone, 'Asia/Ho_Chi_Minh');
    assert.equal(result.cleaningMinutes, 15);
    assert.equal(await Showtime.countDocuments(), 0);
    assert.ok(result.days.every(item => item.slots.every(slot => ['Room 1', 'Room 2'].includes(slot.room))));
  });
  await t.test('existing schedules, previous-day overlap and cleanup affect automatic room selection', async () => {
    await existing(rooms[0], '09:00');
    let result = await preview();
    assert.equal(result.days[0].slots[0].room, 'Room 2');
    assert.equal(result.days[0].slots[1].room, 'Room 1');
    await Showtime.deleteMany({});
    // A legacy name-only reference is matched case-insensitively.
    await Showtime.create({ movie: otherMovie._id, cinema: 'test cinema', room: 'room 1', startTime: new Date(`${day()}T08:00:00+07:00`), price: 90000 });
    result = await preview();
    assert.equal(result.days[0].slots[0].room, 'Room 2');
    await Showtime.deleteMany({});
    // 09:00–11:00 would overlap the next film's 11:10 start after cleanup.
    await existing(rooms[0], '11:10');
    result = await preview();
    assert.equal(result.days[0].slots[0].room, 'Room 2');
    result = await preview({ ...input, endDate: day(), closingTime: '11:00' });
    assert.equal(result.days[0].slots[0].room, 'Room 2');
    await Showtime.deleteMany({});
    const overnight = await Movie.create({ title: 'Previous Day Long Movie', duration: 600 });
    await Showtime.create({ movie: overnight._id, roomId: rooms[0]._id, cinema: 'Test Cinema', room: 'Room 1',
      startTime: new Date(`${day(-1)}T23:00:00+07:00`), price: 90000 });
    result = await preview();
    assert.equal(result.days[0].slots[0].room, 'Room 2');
    await Showtime.deleteMany({});
    for (const room of rooms) await existing(room, '09:00');
    result = await preview();
    assert.equal(result.days[0].slots[0].startTime, new Date(`${day()}T11:15:00+07:00`).toISOString());
    await Showtime.deleteMany({});
  });
  await t.test('a movie may end exactly at closing; no available window gives an empty preview', async () => {
    const oneDay = { ...input, endDate: day(), closingTime: '11:00' };
    assert.equal((await preview(oneDay)).total, 1);
    for (const room of rooms) await existing(room, '09:00');
    const result = await preview(oneDay);
    assert.equal(result.total, 0);
    assert.equal(result.token, null);
    assert.equal(result.days[0].slots.length, 0);
    await Showtime.deleteMany({});
  });
  await t.test('expired, tampered, foreign and client-edited previews cannot be confirmed', async () => {
    const result = await preview();
    assert.equal((await request('/suggestions/confirm', { token: result.token + 'tampered' })).status, 400);
    assert.equal((await request('/suggestions/confirm', { token: result.token }, other)).status, 403);
    assert.equal((await request('/suggestions/confirm', { token: result.token, price: 1 })).status, 400);
    const originalNow = Date.now;
    Date.now = () => originalNow() + 16 * 60000;
    try {
      // HTTP authentication tokens are created with the same shifted clock.
      assert.equal((await request('/suggestions/confirm', { token: result.token })).status, 410);
    } finally { Date.now = originalNow; }
    assert.equal(await Showtime.countDocuments(), 0);
  });
  await t.test('saving rechecks movie/room changes and newly conflicting showtimes without partial writes', async () => {
    let result = await preview();
    await Movie.updateOne({ _id: movie._id }, { $set: { duration: 121 } });
    assert.equal((await request('/suggestions/confirm', { token: result.token })).status, 409);
    await Movie.updateOne({ _id: movie._id }, { $set: { duration: 120 } });
    result = await preview();
    await CinemaRoom.updateOne({ _id: rooms[0]._id }, { $set: { seats: ['A1', 'A2', 'A3'] } });
    assert.equal((await request('/suggestions/confirm', { token: result.token })).status, 409);
    result = await preview();
    await existing(rooms[0], '09:00');
    assert.equal((await request('/suggestions/confirm', { token: result.token })).status, 409);
    assert.equal(await Showtime.countDocuments(), 1);
    await Showtime.deleteMany({});
  });
  await t.test('an insertion failure rolls back all created slots and releases the shared guard', async () => {
    const result = await preview();
    const original = Showtime.insertMany;
    Showtime.insertMany = async function (documents, options) {
      await original.call(this, [documents[0]], options);
      throw new Error('Private batch failure');
    };
    try {
      const response = await request('/suggestions/confirm', { token: result.token });
      assert.equal(response.status, 500);
      assert.equal(JSON.stringify(response.data).includes('Private batch failure'), false);
      assert.equal(await Showtime.countDocuments(), 0);
    } finally { Showtime.insertMany = original; }
    assert.equal((await request('/suggestions/confirm', { token: result.token })).status, 201);
    await Showtime.deleteMany({});
  });
  await t.test('simultaneous confirmations create exactly one complete batch with current seat metadata', async () => {
    const result = await preview();
    const responses = await Promise.all([request('/suggestions/confirm', { token: result.token }), request('/suggestions/confirm', { token: result.token })]);
    assert.deepEqual(responses.map(item => item.status).sort(), [201, 409]);
    assert.equal(await Showtime.countDocuments(), 18);
    const show = await Showtime.findOne({ roomId: rooms[0]._id });
    assert.equal(show.price, 80000);
    assert.equal(show.seats.length, 3);
    assert.equal(show.seats.find(seat => seat.number === 'A2').type, 'VIP');
    assert.equal(show.seats.find(seat => seat.number === 'A2').condition, 'Broken');
    assert.ok(show.seats.every(seat => seat.status === 'available'));
    assert.equal((await request('/suggestions/confirm', { token: result.token })).status, 409);
    await Showtime.deleteMany({});
  });
  await t.test('missing neighbour duration fails closed and manual room selection still works', async () => {
    await Showtime.create({ movie: new mongoose.Types.ObjectId(), roomId: rooms[0]._id, cinema: rooms[0].cinema, room: rooms[0].name, startTime: new Date(`${day()}T09:00:00+07:00`), price: 80000 });
    assert.equal((await request()).status, 409);
    await Showtime.deleteMany({});
    const manual = await request('', { movie: String(movie._id), cinema: 'Test Cinema', room: 'Room 2', startTime: new Date(`${day()}T06:00:00+07:00`).toISOString(), price: 85000 });
    assert.equal(manual.status, 201);
    assert.equal(manual.data.showtime.room, 'Room 2');
  });
});
