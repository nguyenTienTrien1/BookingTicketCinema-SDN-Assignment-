import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from "../../src/app.js";
import Movie from "../../src/models/movies/Movie.js";
import User from "../../src/models/users/User.js";
import Showtime from "../../src/models/cinema/Showtime.js";
import Booking from "../../src/models/bookings/Booking.js";
import { createBooking } from "../../src/services/bookings/bookingService.js";

test('UC-13.1 Add Movie and UC-13.2 View Movies', async (t) => {
  // Every run creates its own database. Never write to or clear booking_cinema.
  const dbName = `booking_cinema_movies_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', {
    dbName, serverSelectionTimeoutMS: 5000
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/movies`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const admin = await User.create({ fullName: 'Movie Test Admin', email: 'admin@movies.test', password: randomUUID(), role: 'admin' });
  const member = await User.create({ fullName: 'Movie Test Member', email: 'member@movies.test', password: randomUUID(), role: 'member', status: 'Active' });
  const employee = await User.create({ fullName: 'Movie Test Employee', email: 'employee@movies.test', password: randomUUID(), role: 'employee' });
  function token(user) {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302', { expiresIn: '5m' });
  }
  async function request(path = '', user, body, method) {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Cookie = `token=${token(user)}`;
    const response = await fetch(base + path, {
      method: method || (body === undefined ? 'GET' : 'POST'), headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
  }
  const valid = {
    title: '  Movie [Test]  ', description: 'Test movie description', genre: ['Action', 'Drama'],
    duration: 120, classification: 'T16', releaseDate: '2026-10-29',
    poster: '/images/posters/test.jpg', banner: 'https://example.com/banner.jpg', rating: 8.2, featured: true
  };

  await t.test('anonymous, Member and Employee cannot access Admin operations', async () => {
    for (const user of [undefined, member, employee]) {
      const expected = user ? 403 : 401;
      assert.equal((await request('/admin', user)).status, expected);
      assert.equal((await request('', user, valid)).status, expected);
    }
    assert.equal(await Movie.countDocuments(), 0);
  });
  await t.test('empty catalogue is a successful empty result', async () => {
    const result = await request('/admin', admin);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { movies: [], total: 0, page: 1, totalPages: 0 });
  });
  await t.test('Admin creates a persisted movie and creator cannot be spoofed', async () => {
    const result = await request('', admin, { ...valid, createdBy: member._id, ageLimit: 0 });
    assert.equal(result.status, 201);
    const movie = await Movie.findById(result.data.movie._id);
    assert.equal(movie.title, 'Movie [Test]');
    assert.equal(movie.ageLimit, 16);
    assert.equal(movie.classification, 'T16');
    assert.equal(String(movie.createdBy), String(admin._id));
    assert.equal(movie.rating, 8.2);
  });
  await t.test('same title and release date is rejected, ignoring title case and spaces', async () => {
    assert.equal((await request('', admin, { ...valid, title: 'movie [test]' })).status, 409);
    assert.equal(await Movie.countDocuments(), 1);
  });
  await t.test('invalid and missing fields never insert a movie', async () => {
    const invalidInputs = [
      {}, { title: ' ' }, { description: ' ' }, { duration: 0 }, { duration: 1.5 },
      { duration: '120' }, { genre: [] }, { genre: [' '] }, { genre: { $ne: '' } },
      { releaseDate: '2026-02-30' }, { releaseDate: '' }, { classification: 'T99' },
      { rating: 11 }, { poster: 'javascript:alert(1)' }, { poster: '' },
      { banner: 'data:image/png;base64,test' }, { featured: 'false' }
    ];
    for (const input of invalidInputs) {
      const body = Object.keys(input).length ? { ...valid, ...input } : {};
      assert.equal((await request('', admin, body)).status, 400, JSON.stringify(input));
    }
    assert.equal(await Movie.countDocuments(), 1);
  });
  await t.test('paginated search treats regex characters literally', async () => {
    await Movie.create({ title: 'Other Movie', duration: 90 });
    const first = await request('/admin?limit=1&page=1', admin);
    const second = await request('/admin?limit=1&page=2', admin);
    assert.equal(first.data.total, 2);
    assert.equal(first.data.totalPages, 2);
    assert.notEqual(first.data.movies[0]._id, second.data.movies[0]._id);
    const search = await request('/admin?search=%5Btest%5D', admin);
    assert.equal(search.data.total, 1);
    assert.equal(search.data.movies[0].title, 'Movie [Test]');
    assert.equal((await request('/admin?search=not-found', admin)).data.total, 0);
    for (const query of ['page=-1', 'page=1.5', 'limit=100', 'search[x]=bad']) {
      assert.equal((await request(`/admin?${query}`, admin)).status, 400);
    }
  });
  await t.test('legacy seeded movies remain readable without a classification field', async () => {
    const result = await request();
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.data));
    assert.ok(result.data.some((movie) => movie.title === 'Other Movie'));
  });
  await t.test('C-classified movies are Admin-only and cannot be booked', async () => {
    const result = await request('', admin, { ...valid, title: 'Restricted Movie', classification: 'C' });
    assert.equal(result.status, 201);
    assert.ok(!(await request()).data.some((movie) => movie._id === result.data.movie._id));
    assert.equal((await request('/admin?search=Restricted', admin)).data.total, 1);
    const showtime = await Showtime.create({ movie: result.data.movie._id, cinema: 'Test', room: '1',
      startTime: new Date('2027-01-01'), price: 100000, seats: [{ number: 'A1' }] });
    await assert.rejects(createBooking({ userId: member._id, showtimeId: showtime._id, seats: ['A1'] }), { status: 400 });
    assert.equal(await Booking.countDocuments(), 0);
    assert.equal((await Showtime.findById(showtime._id)).seats[0].status, 'available');
  });
  await t.test('update validates permissions, IDs, payload and persists audit data', async () => {
    const created = await request('', admin, { ...valid, title: 'Editable Movie' });
    const id = created.data.movie._id;
    const body = { ...valid, title: 'Updated Movie', version: 0, createdBy: member._id };
    assert.equal((await request(`/admin/${id}`, admin)).status, 200);
    assert.equal((await request(`/admin/${id}`, member)).status, 403);
    for (const user of [undefined, member, employee]) {
      assert.equal((await request(`/${id}`, user, body, 'PUT')).status, user ? 403 : 401);
    }
    assert.equal((await request('/bad-id', admin, body, 'PUT')).status, 400);
    assert.equal((await request(`/${new mongoose.Types.ObjectId()}`, admin, body, 'PUT')).status, 404);
    assert.equal((await request(`/${id}`, admin, { ...body, duration: -1 }, 'PUT')).status, 400);
    assert.equal((await request(`/${id}`, admin, { ...valid, version: 0 }, 'PUT')).status, 409);
    assert.equal((await request(`/${id}`, admin, valid, 'PUT')).status, 400);
    const updated = await request(`/${id}`, admin, body, 'PUT');
    assert.equal(updated.status, 200);
    assert.equal(updated.data.movie.title, 'Updated Movie');
    assert.equal(updated.data.movie.__v, 1);
    assert.equal(updated.data.movie.updatedBy, String(admin._id));
    assert.equal(updated.data.movie.createdBy, String(admin._id));
    assert.equal((await request(`/${id}`, admin, { ...body, title: 'Stale edit' }, 'PUT')).status, 409);
    assert.equal((await Movie.findById(id)).title, 'Updated Movie');
  });
  await t.test('scheduled movies protect material fields, bookings and deletion', async () => {
    const created = await request('', admin, { ...valid, title: 'Scheduled Movie' });
    const id = created.data.movie._id;
    const showtime = await Showtime.create({ movie: id, cinema: 'Test', room: '2', startTime: new Date('2027-01-01'), price: 100000,
      seats: [{ number: 'A1', status: 'booked' }, { number: 'A2', status: 'held', holdUntil: new Date(Date.now() + 600000) }] });
    for (const change of [{ duration: 125 }, { classification: 'C' }, { title: 'Renamed' }, { releaseDate: '2027-02-01' }]) {
      assert.equal((await request(`/${id}`, admin, { ...valid, title: 'Scheduled Movie', version: 0, ...change }, 'PUT')).status, 409);
    }
    const allowed = await request(`/${id}`, admin, { ...valid, title: 'Scheduled Movie', version: 0, description: 'New description' }, 'PUT');
    assert.equal(allowed.status, 200);
    assert.equal((await request(`/${id}`, admin, { version: 1 }, 'DELETE')).status, 409);
    assert.equal((await Showtime.findById(showtime._id)).seats[0].status, 'booked');
    assert.equal((await Movie.findById(id)).deletedAt, null);
  });
  await t.test('deletion requires Admin and a current version, and retains an audit record', async () => {
    const created = await request('', admin, { ...valid, title: 'Removable Movie' });
    const id = created.data.movie._id;
    for (const user of [undefined, member, employee]) {
      assert.equal((await request(`/${id}`, user, { version: 0 }, 'DELETE')).status, user ? 403 : 401);
    }
    assert.equal((await request('/bad-id', admin, { version: 0 }, 'DELETE')).status, 400);
    assert.equal((await request(`/${id}`, admin, {}, 'DELETE')).status, 400);
    assert.equal((await request(`/${id}`, admin, { version: 99 }, 'DELETE')).status, 409);
    assert.equal((await request(`/${id}`, admin, { version: 0 }, 'DELETE')).status, 200);
    const archived = await Movie.findById(id);
    assert.ok(archived.deletedAt);
    assert.equal(String(archived.deletedBy), String(admin._id));
    assert.equal((await request(`/admin/${id}`, admin)).status, 404);
    assert.equal((await request('/admin?search=Removable', admin)).data.total, 0);
    assert.ok(!(await request()).data.some((movie) => movie._id === id));
    assert.equal((await request(`/${id}`, admin, { version: 0 }, 'DELETE')).status, 404);
  });
  await t.test('failed update does not change the persisted movie', async () => {
    const created = await request('', admin, { ...valid, title: 'DB Failure Movie' });
    const mock = t.mock.method(Movie, 'findOneAndUpdate', async () => { throw new Error('Database write failed'); });
    try {
      assert.equal((await request(`/${created.data.movie._id}`, admin, { ...valid, title: 'Unsaved', version: 0 }, 'PUT')).status, 500);
    } finally { mock.mock.restore(); }
    assert.equal((await Movie.findById(created.data.movie._id)).title, 'DB Failure Movie');
  });
  await t.test('inactive Admin sessions cannot create or list movies', async () => {
    await User.updateOne({ _id: admin._id }, { $set: { status: 'Inactive' } });
    assert.equal((await request('/admin', admin)).status, 401);
    assert.equal((await request('', admin, valid)).status, 401);
    await User.updateOne({ _id: admin._id }, { $set: { status: 'Active' } });
  });
  await t.test('database failures return an error instead of success or partial data', async () => {
    const mock = t.mock.method(Movie, 'countDocuments', async () => { throw new Error('Test database unavailable'); });
    try {
      const result = await request('/admin', admin);
      assert.equal(result.status, 500);
      assert.equal(result.data.movies, undefined);
      assert.ok(!result.data.message.includes('Test database unavailable'));
    } finally {
      mock.mock.restore();
    }
  });
});
