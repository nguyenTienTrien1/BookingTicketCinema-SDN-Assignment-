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
import Food from "../../src/models/catalogue/Food.js";
import Booking from "../../src/models/bookings/Booking.js";

test('UC-7.3 View Booking History', async (t) => {
    const dbName = `booking_cinema_history_test_${randomUUID().replaceAll('-', '')}`;
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', {
        dbName, serverSelectionTimeoutMS: 5000
    });
    t.after(async () => {
        assert.equal(mongoose.connection.name, dbName);
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api/bookings`;
    const member = await User.create({ fullName: 'Member A', email: 'a@history.test', password: randomUUID(), status: 'Active' });
    const other = await User.create({ fullName: 'Member B', email: 'b@history.test', password: randomUUID(), status: 'Active' });
    const empty = await User.create({ fullName: 'No bookings', email: 'empty@history.test', password: randomUUID(), status: 'Active' });
    const employee = await User.create({ fullName: 'Employee', email: 'employee@history.test', password: randomUUID(), role: 'employee' });
    const admin = await User.create({ fullName: 'Admin', email: 'admin@history.test', password: randomUUID(), role: 'admin' });
    const banned = await User.create({ fullName: 'Banned', email: 'banned@history.test', password: randomUUID(), status: 'Banned' });
    const movie = await Movie.create({ title: 'History Movie' });
    const food = await Food.create({ name: 'Popcorn', price: 20000, stock: 50 });
    const showtime = await Showtime.create({ movie: movie._id, cinema: 'Cinema+', room: 'Room 1', startTime: new Date(Date.now() + 86400000), price: 80000,
        seats: [{ number: 'A1', status: 'held', holdUntil: new Date(Date.now() + 600000) }] });
    const bookingData = { user: member._id, showtime: showtime._id, seats: ['A1'], foodItems: [{ food: food._id, quantity: 2 }],
        subtotal: 120000, total: 100000, discount: 20000, pointsUsed: 20 };
    const paid = await Booking.create({ ...bookingData, status: 'paid', paymentStatus: 'paid', paymentMethod: 'vnpay', paymentRef: 'HISTORY-PAID', createdAt: new Date('2026-01-01') });
    const cancelled = await Booking.create({ ...bookingData, status: 'cancelled', paymentStatus: 'failed', createdAt: new Date('2026-01-02') });
    const expired = await Booking.create({ ...bookingData, expiresAt: new Date(Date.now() - 60000), createdAt: new Date('2026-01-03') });
    const pending = await Booking.create({ ...bookingData, expiresAt: new Date(Date.now() + 600000), createdAt: new Date('2026-01-04') });
    await Booking.create({ ...bookingData, user: other._id, paymentRef: 'OTHER-MEMBER-PRIVATE' });

    function token(user) { return jwt.sign({ id: user._id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302', { expiresIn: '5m' }); }
    async function request(session = token(member), query = '') {
        const response = await fetch(base + query, { headers: session ? { Cookie: `token=${session}` } : {} });
        return { status: response.status, data: await response.json() };
    }

    await t.test('authentication, active status and Member role are required', async () => {
        for (const [session, expected] of [[null, 401], ['invalid', 401], [token(banned), 401], [token(employee), 403], [token(admin), 403]]) {
            assert.equal((await request(session)).status, expected);
        }
    });
    await t.test('returns only owned bookings newest first, including cancellation and expired holds', async () => {
        const result = await request();
        assert.equal(result.status, 200);
        assert.deepEqual(result.data.map((item) => item._id), [pending, expired, cancelled, paid].map((item) => String(item._id)));
        const row = result.data.find((item) => item._id === String(paid._id));
        assert.equal(row.showtime.movie.title, 'History Movie');
        assert.equal(row.showtime.cinema, 'Cinema+');
        assert.deepEqual(row.seats, ['A1']);
        assert.equal(row.foodItems[0].food.name, 'Popcorn');
        assert.equal(row.foodItems[0].quantity, 2);
        assert.equal(row.total, 100000);
        assert.equal(row.discount, 20000);
        assert.equal(row.paymentStatus, 'paid');
        assert.equal(row.paymentRef, 'HISTORY-PAID');
        assert.equal('seats' in row.showtime, false);
        assert.equal('stock' in row.foodItems[0].food, false);
        assert.equal('user' in row, false);
    });
    await t.test('client-supplied identity never changes whose history is returned', async () => {
        for (const query of [`?userId=${other._id}`, '?userId[$ne]=null', '?userId=invalid']) {
            const result = await request(token(member), query);
            assert.equal(result.status, 200);
            assert.equal(result.data.length, 4);
            assert.equal(JSON.stringify(result.data).includes('OTHER-MEMBER-PRIVATE'), false);
        }
        const result = await request(token(other), `?userId=${member._id}`);
        assert.equal(result.data.length, 1);
        assert.equal(result.data[0].paymentRef, 'OTHER-MEMBER-PRIVATE');
    });
    await t.test('a member without bookings receives an empty list', async () => {
        assert.deepEqual(await request(token(empty)), { status: 200, data: [] });
    });
    await t.test('viewing history never modifies bookings, seat holds or points', async () => {
        const before = JSON.stringify(await Booking.find().sort({ _id: 1 }).lean());
        const seatsBefore = JSON.stringify((await Showtime.findById(showtime._id)).seats);
        const pointsBefore = (await User.findById(member._id)).memberPoints;
        await request();
        assert.equal(JSON.stringify(await Booking.find().sort({ _id: 1 }).lean()), before);
        assert.equal(JSON.stringify((await Showtime.findById(showtime._id)).seats), seatsBefore);
        assert.equal((await User.findById(member._id)).memberPoints, pointsBefore);
    });
    await t.test('historical bookings remain accessible when catalogue references are missing', async () => {
        await Movie.deleteOne({ _id: movie._id });
        await Food.deleteOne({ _id: food._id });
        let result = await request();
        assert.equal(result.status, 200);
        assert.equal(result.data.length, 4);
        assert.equal(result.data[0].showtime.movie, null);
        assert.equal(result.data[0].foodItems[0].food, null);
        await Showtime.deleteOne({ _id: showtime._id });
        result = await request();
        assert.equal(result.data.length, 4);
        assert.equal(result.data[0].showtime, null);
        assert.equal(result.data.find((item) => item._id === String(paid._id)).total, 100000);
    });
    await t.test('retrieval failures return an error without leaking internal details', async () => {
        const find = t.mock.method(Booking, 'find', () => { throw new Error('Private history database failure'); });
        try {
            const result = await request();
            assert.equal(result.status, 500);
            assert.equal(JSON.stringify(result.data).includes('Private history'), false);
        } finally { find.mock.restore(); }
    });
});
