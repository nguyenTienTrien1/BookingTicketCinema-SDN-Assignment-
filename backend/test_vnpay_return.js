import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID, randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from './src/app.js';
import User from './src/models/User.js';
import Movie from './src/models/Movie.js';
import Showtime from './src/models/Showtime.js';
import Food from './src/models/Food.js';
import Promotion from './src/models/Promotion.js';
import Booking from './src/models/Booking.js';
import PaymentAttempt from './src/models/PaymentAttempt.js';
import RevenueEntry from './src/models/RevenueEntry.js';
import { signature } from './src/services/vnpayService.js';

test('Signed Sandbox return fallback without IPN', async t => {
    process.env.NODE_ENV = 'test'; process.env.POINT_REDEEM_STEP = '1';
    Object.assign(process.env, { VNPAY_TMN_CODE: 'RETURN01', VNPAY_HASH_SECRET: randomUUID(), VNPAY_RETURN_URL: 'http://localhost/api/payments/vnpay/return', VNPAY_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html', VNPAY_SANDBOX_RETURN_FALLBACK: 'true' });
    const dbName = 'cinema_vnpay_return_' + randomUUID().replaceAll('-', '');
    await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(async () => { await new Promise(resolve => server.close(resolve)); assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
    await Promise.all([User.init(), Booking.init(), Promotion.init(), PaymentAttempt.init(), RevenueEntry.init()]);
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    const movie = await Movie.create({ title: 'Sandbox return test', classification: 'P', duration: 90 });
    async function fixture() {
        const user = await User.create({ fullName: 'Return Member', email: randomUUID() + '@return.test', password: randomUUID(), role: 'member', status: 'Active', memberPoints: 100 });
        const show = await Showtime.create({ movie: movie.id, cinema: 'Return Cinema', room: randomUUID(), startTime: new Date(Date.now() + 3600000), price: 100000, seats: [{ number: 'A1' }] });
        const food = await Food.create({ name: 'Food ' + randomUUID(), price: 50000, stock: 20, available: true });
        const promo = await Promotion.create({ code: 'P' + randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase(), name: 'Return Discount', discountType: 'percentage', value: 10, minOrder: 0, scope: 'all', stackable: true, startsAt: new Date(Date.now() - 3600000), endsAt: new Date(Date.now() + 3600000), usageLimit: 10 });
        const headers = { 'Content-Type': 'application/json', Cookie: 'token=' + jwt.sign({ id: user.id, tokenVersion: 0 }, process.env.JWT_SECRET) };
        const created = await fetch(base + '/bookings', { method: 'POST', headers, body: JSON.stringify({ showtimeId: show.id, seats: ['A1'], foodItems: [{ food: food.id, quantity: 1 }], points: 20, promotionCode: promo.code }) });
        assert.equal(created.status, 201); const booking = await created.json();
        const payment = await fetch(base + '/bookings/' + booking._id + '/pay', { method: 'POST', headers, body: JSON.stringify({ method: 'vnpay' }) });
        assert.equal(payment.status, 200); const attempt = await payment.json();
        return { user, show, food, promo, booking, reference: attempt.reference, providerReference: String(randomInt(100000000000, 999999999999)) };
    }
    function params(fix, extra = {}) {
        const p = { vnp_TmnCode: process.env.VNPAY_TMN_CODE, vnp_TxnRef: fix.reference, vnp_Amount: String(fix.booking.total * 100), vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: fix.providerReference, vnp_BankCode: 'NCB', ...extra };
        p.vnp_SecureHash = signature(p); return p;
    }
    const returned = p => fetch(base + '/payments/vnpay/return?' + new URLSearchParams(p), { redirect: 'manual' });
    async function unchanged(fix) {
        const booking = await Booking.findById(fix.booking._id);
        assert.equal(booking.status, 'pending'); assert.equal(booking.paymentStatus, 'unpaid'); assert.equal(booking.tickets.length, 0);
        assert.equal((await User.findById(fix.user.id)).memberPoints, 100); assert.equal((await Food.findById(fix.food.id)).stock, 20); assert.equal((await Promotion.findById(fix.promo.id)).usedCount, 0);
    }

    await t.test('missing/forged signature, wrong merchant/amount and absent provider ID never settle', async () => {
        const fix = await fixture();
        const invalid = [
            { vnp_TxnRef: fix.reference, success: 'true', vnp_ResponseCode: '00' },
            { ...params(fix), vnp_SecureHash: 'a'.repeat(128) },
            params(fix, { vnp_TmnCode: 'WRONG' }),
            params(fix, { vnp_Amount: '100' }),
            params(fix, { vnp_TransactionNo: '0' }),
            params(fix, { vnp_TxnRef: 'unknown-reference' }),
        ];
        for (const p of invalid) { assert.equal((await returned(p)).status, 302); await unchanged(fix); }
        const arrays = await fetch(base + '/payments/vnpay/return?vnp_TxnRef=' + fix.reference + '&vnp_SecureHash[]=bad', { redirect: 'manual' });
        assert.equal(arrays.status, 302); await unchanged(fix);
    });
    await t.test('explicit opt-in, HTTPS Sandbox host and non-production environment are required', async () => {
        const fix = await fixture(), valid = params(fix);
        const cases = [
            { VNPAY_SANDBOX_RETURN_FALLBACK: 'false' },
            { NODE_ENV: 'production' },
            { VNPAY_URL: 'https://payments.example.test/pay' },
            { VNPAY_URL: 'http://sandbox.vnpayment.vn/paymentv2/vpcpay.html' },
        ];
        for (const config of cases) {
            const old = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
            Object.assign(process.env, config);
            try { assert.equal((await returned(valid)).status, 302); await unchanged(fix); } finally { Object.assign(process.env, old); }
        }
    });
    await t.test('valid return with no IPN issues tickets, applies promotion/points and redirects to result', async () => {
        const fix = await fixture(); assert.equal(fix.booking.total, 115000);
        const result = await returned(params(fix)); assert.equal(result.status, 302);
        assert.equal(new URL(result.headers.get('location')).searchParams.get('reference'), fix.reference);
        const b = await Booking.findById(fix.booking._id); assert.equal(b.status, 'paid'); assert.equal(b.paymentStatus, 'paid'); assert.equal(b.paymentMethod, 'vnpay'); assert.equal(b.tickets.length, 1);
        assert.equal((await User.findById(fix.user.id)).memberPoints, 80); assert.equal((await Food.findById(fix.food.id)).stock, 19); assert.equal((await Promotion.findById(fix.promo.id)).usedCount, 1);
        const entry = await RevenueEntry.findOne({ booking: b._id }); assert.equal(entry.amount, 115000); assert.equal(entry.discounts, 15000); assert.equal(entry.points, 20000);
        const originalCode = b.tickets[0].code;
        await returned(params(fix));
        const lateIpn = await fetch(base + '/payments/vnpay/ipn?' + new URLSearchParams(params(fix))); assert.equal((await lateIpn.json()).RspCode, '02');
        const repeated = await Booking.findById(b._id); assert.equal(repeated.tickets[0].code, originalCode);
        assert.equal(await RevenueEntry.countDocuments({ booking: b._id }), 1); assert.equal((await User.findById(fix.user.id)).memberPoints, 80); assert.equal((await Promotion.findById(fix.promo.id)).usedCount, 1);
    });
    await t.test('signed failure records failure without issuing tickets or spending balance/stock', async () => {
        const fix = await fixture(); await returned(params(fix, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }));
        await unchanged(fix); assert.equal((await PaymentAttempt.findOne({ ref: fix.reference })).status, 'failed'); assert.equal((await Booking.findById(fix.booking._id)).activePayment, null);
    });
    await t.test('verified payment after hold expiration follows the existing refund flow, never issues expired tickets', async () => {
        const fix = await fixture(); await Booking.updateOne({ _id: fix.booking._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
        await returned(params(fix));
        const b = await Booking.findById(fix.booking._id); assert.equal(b.status, 'refunded'); assert.equal(b.tickets.length, 0); assert.equal(b.refund.points, 115);
        assert.equal((await User.findById(fix.user.id)).memberPoints, 215); assert.equal((await Food.findById(fix.food.id)).stock, 20); assert.equal((await Promotion.findById(fix.promo.id)).usedCount, 0);
        await returned(params(fix)); assert.equal((await User.findById(fix.user.id)).memberPoints, 215);
    });
});
