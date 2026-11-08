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
import Showtime from "../../src/models/cinema/Showtime.js";
import Food from "../../src/models/catalogue/Food.js";
import Promotion from "../../src/models/catalogue/Promotion.js";
import Booking from "../../src/models/bookings/Booking.js";
import PaymentAttempt from "../../src/models/payments/PaymentAttempt.js";
import RevenueEntry from "../../src/models/revenue/RevenueEntry.js";
import { signature } from "../../src/services/payments/vnpayService.js";

test('Member online promotion pricing, authorization and atomic settlement', async t => {
    process.env.POINT_REDEEM_STEP = '1';
    Object.assign(process.env, { VNPAY_TMN_CODE: 'ONLINE_PROMO_TEST', VNPAY_HASH_SECRET: randomUUID(), VNPAY_RETURN_URL: 'http://localhost/api/payments/vnpay/return' });
    const dbName = 'cinema_online_promo_' + randomUUID().replaceAll('-', '');
    await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(async () => { await new Promise(resolve => server.close(resolve)); assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
    await Promise.all([User.init(), Promotion.init(), Booking.init(), PaymentAttempt.init(), RevenueEntry.init()]);
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    async function account(role = 'member') { return User.create({ fullName: role, email: randomUUID() + '@online-promo.test', password: randomUUID(), role, status: 'Active', memberPoints: 300 }); }
    const member = await account(), other = await account(), employee = await account('employee'), admin = await account('admin');
    const movie = await Movie.create({ title: 'Online promotion', classification: 'P', duration: 90 });
    async function request(path, actor = member, method = 'GET', body, headers = {}) {
        const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Cookie: 'token=' + jwt.sign({ id: actor.id, tokenVersion: actor.tokenVersion || 0 }, process.env.JWT_SECRET) } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, data: await response.json() };
    }
    async function fixture({ price = 200000, unitPrice = 25000, quantity = 2, points = 0, user = member, extra = {} } = {}) {
        const show = await Showtime.create({ movie: movie.id, cinema: 'Online Cinema', room: randomUUID(), price, startTime: new Date(Date.now() + 3600000), seats: [{ number: 'A1' }] });
        const food = await Food.create({ name: 'Food ' + randomUUID(), price: unitPrice, stock: 100, available: true });
        const result = await request('/bookings', user, 'POST', { showtimeId: show.id, seats: ['A1'], foodItems: quantity ? [{ food: food.id, quantity }] : [], points, ...extra });
        assert.equal(result.status, 201, JSON.stringify(result.data)); return { booking: result.data, show, food, user };
    }
    const promo = (extra = {}) => Promotion.create({ code: 'P' + randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase(), name: 'Online promotion', discountType: 'percentage', value: 10, scope: 'food', minOrder: 50000, stackable: true, startsAt: new Date(Date.now() - 3600000), endsAt: new Date(Date.now() + 3600000), usageLimit: 10, ...extra });
    const apply = (fix, code, actor = fix.user, headers) => request('/bookings/' + fix.booking._id + '/promotion', actor, 'PATCH', { code }, headers);
    const points = (fix, value) => request('/bookings/' + fix.booking._id + '/points', fix.user, 'PATCH', { points: value });
    const payPoints = fix => request('/bookings/' + fix.booking._id + '/pay', fix.user, 'POST', { method: 'points' });

    await t.test('checkout preview uses server prices without holding seats, reserving inventory or consuming promotion usage', async () => {
        const show = await Showtime.create({ movie: movie.id, cinema: 'Preview Cinema', room: randomUUID(), price: 200000, startTime: new Date(Date.now() + 3600000), seats: [{ number: 'A1' }] });
        const food = await Food.create({ name: 'Preview food', price: 25000, stock: 3, available: true });
        const p = await promo();
        const payload = { showtimeId: show.id, seats: ['A1'], foodItems: [{ food: food.id, quantity: 2 }], code: p.code.toLowerCase(), subtotal: 1, ticketPrice: 1, promotionDiscount: 999999 };
        const before = await Booking.countDocuments();
        const quote = await request('/bookings/promotion-preview', member, 'POST', payload);
        assert.equal(quote.status, 200, JSON.stringify(quote.data));
        assert.equal(quote.data.subtotal, 250000);
        assert.equal(quote.data.promotionDiscount, 5000);
        assert.equal(quote.data.promotion.code, p.code);
        assert.equal(await Booking.countDocuments(), before);
        assert.equal((await Showtime.findById(show.id)).seats[0].status, 'available');
        assert.equal((await Food.findById(food.id)).stock, 3);
        assert.equal((await Promotion.findById(p.id)).usedCount, 0);
        for (const [actor, status] of [[null, 401], [employee, 403], [admin, 403]]) assert.equal((await request('/bookings/promotion-preview', actor, 'POST', payload)).status, status);
        assert.equal((await request('/bookings/promotion-preview', member, 'POST', payload, { Origin: 'https://untrusted.example' })).status, 403);
        assert.equal((await request('/bookings/promotion-preview', member, 'POST', payload, { 'Content-Type': 'text/plain' })).status, 415);
        for (const code of ['', null, {}, '!bad']) assert.equal((await request('/bookings/promotion-preview', member, 'POST', { ...payload, code })).status, 400);
        for (const changes of [{ seats: ['A1', 'A1'] }, { showtimeId: 'bad' }]) assert.equal((await request('/bookings/promotion-preview', member, 'POST', { ...payload, ...changes })).status, 400);
        for (const changes of [{ seats: ['A2'] }, { foodItems: [{ food: food.id, quantity: 4 }] }, { code: 'UNKNOWN' }, { foodItems: [] }]) assert.equal((await request('/bookings/promotion-preview', member, 'POST', { ...payload, ...changes })).status, 409);
        await Promotion.updateOne({ _id: p.id }, { active: false });
        assert.equal((await request('/bookings/promotion-preview', member, 'POST', payload)).status, 409);
    });

    await t.test('only an active Member may edit their own online order; Origin and JSON are enforced', async () => {
        const fix = await fixture(), p = await promo();
        for (const [actor, status] of [[null,401],[employee,403],[admin,403],[other,404]]) assert.equal((await apply(fix, p.code, actor)).status, status);
        assert.equal((await apply(fix, p.code, member, { Origin: 'https://untrusted.example' })).status, 403);
        assert.equal((await apply(fix, p.code, member, { 'Content-Type': 'text/plain' })).status, 415);
        for (const code of [null, {}, [], 123, '!bad']) assert.equal((await apply(fix, code)).status, 400);
        assert.equal((await request('/bookings/' + fix.booking._id + '/promotion', member, 'PATCH', {})).status, 400);
        const counterShow = await Showtime.create({ movie: movie.id, cinema: 'Counter', room: randomUUID(), price: 100000, startTime: new Date(Date.now() + 3600000), seats: [{ number: 'A1' }] });
        const counter = await request('/counter/bookings', employee, 'POST', { customerType: 'member', memberId: member.id, showtimeId: counterShow.id, seats: ['A1'] }); assert.equal(counter.status, 201);
        assert.equal((await request('/bookings/' + counter.data._id + '/promotion', member, 'PATCH', { code: p.code })).status, 403);
    });
    await t.test('apply/remove normalizes codes and preserves holds, inventory, points and usage until payment', async () => {
        const fix = await fixture(), p = await promo();
        const applied = await apply(fix, '  ' + p.code.toLowerCase() + '  ');
        assert.equal(applied.status, 200); assert.equal(applied.data.promotion.code, p.code); assert.equal(applied.data.promotionDiscount, 5000); assert.equal(applied.data.total, 245000);
        assert.equal(applied.data.expiresAt, fix.booking.expiresAt); assert.equal((await Food.findById(fix.food.id)).stock, 100); assert.equal((await Promotion.findById(p.id)).usedCount, 0);
        assert.equal((await apply(fix, '')).data.total, 250000);
        assert.equal((await Booking.findById(fix.booking._id)).promotion, undefined);
    });
    await t.test('ticket/food/all scopes, minimum, rounding, cap and fixed discount clamps are server-calculated', async () => {
        const fix = await fixture({ price: 200001, unitPrice: 33333, quantity: 3 });
        const percent = await promo({ value: 17, minOrder: 0 }); assert.equal((await apply(fix, percent.code)).data.promotionDiscount, 16999);
        const capped = await promo({ value: 17, minOrder: 0, maxDiscount: 10000 }); assert.equal((await apply(fix, capped.code)).data.promotionDiscount, 10000);
        const threshold = await promo({ minOrder: 100000 }); assert.equal((await apply(fix, threshold.code)).status, 409);
        const ticket = await promo({ scope: 'ticket', discountType: 'fixed', value: 999999, minOrder: 0 }); assert.equal((await apply(fix, ticket.code)).data.promotionDiscount, 200001);
        const all = await promo({ scope: 'all', value: 50, minOrder: 0 }); assert.equal((await apply(fix, all.code)).data.total, 150000);
        const empty = await fixture({ quantity: 0 }); assert.equal((await apply(empty, percent.code)).status, 409);
    });
    await t.test('unknown, expired, future, disabled, deleted and exhausted codes do not replace accepted pricing', async () => {
        const fix = await fixture(), valid = await promo(); await apply(fix, valid.code);
        assert.equal((await apply(fix, 'UNKNOWN')).status, 409);
        for (const change of [{ endsAt: new Date(Date.now() - 1) }, { startsAt: new Date(Date.now() + 60000) }, { active: false }, { deletedAt: new Date() }, { usageLimit: 1, usedCount: 1 }]) {
            const invalid = await promo(change); assert.equal((await apply(fix, invalid.code)).status, 409);
        }
        const stored = await Booking.findById(fix.booking._id); assert.equal(stored.promotion.code, valid.code); assert.equal(stored.total, 245000);
    });
    await t.test('points follow discount and exclusive codes reject stacking in both directions atomically', async () => {
        const fix = await fixture(), p = await promo(); await apply(fix, p.code);
        assert.equal((await points(fix, 20)).data.total, 225000);
        const exclusive = await promo({ scope: 'all', minOrder: 0, stackable: false });
        assert.equal((await apply(fix, exclusive.code)).status, 409); assert.equal((await Booking.findById(fix.booking._id)).promotion.code, p.code);
        await points(fix, 0); assert.equal((await apply(fix, exclusive.code)).status, 200);
        assert.equal((await points(fix, 1)).status, 409); assert.equal((await Booking.findById(fix.booking._id)).pointsUsed, 0);
        const full = await fixture({ points: 250 }); const discount = await promo({ scope: 'all', minOrder: 0 });
        assert.equal((await apply(full, discount.code)).status, 400); assert.equal((await Booking.findById(full.booking._id)).total, 0);
    });
    await t.test('initial code is validated and client-submitted totals/discount snapshots cannot alter the price', async () => {
        const p = await promo();
        const fix = await fixture({ extra: { promotionCode: p.code, promotionDiscount: 999999, total: 1, promotion: { code: 'FAKE' } } });
        assert.equal(fix.booking.promotionDiscount, 5000); assert.equal(fix.booking.total, 245000);
        const invalid = await request('/bookings', member, 'POST', { showtimeId: fix.show.id, seats: ['A1'], promotionCode: 'UNKNOWN' });
        assert.equal(invalid.status, 409); assert.equal(await Booking.countDocuments({ showtime: fix.show.id }), 1);
    });
    await t.test('switching from points to an exclusive code is explicit and atomic for online and counter orders', async () => {
        for (const counter of [false, true]) {
            const fix = await fixture({ points: 20 });
            if (counter) {
                await request('/bookings/' + fix.booking._id + '/cancel', member, 'POST', {});
                const sale = await request('/counter/bookings', employee, 'POST', { customerType: 'member', memberId: member.id, showtimeId: fix.show.id, seats: ['A1'], foodItems: [{ food: fix.food.id, quantity: 2 }], points: 20 });
                assert.equal(sale.status, 201); fix.booking = sale.data;
            }
            const p = await promo({ scope: 'all', minOrder: 0, stackable: false });
            const path = (counter ? '/counter/bookings/' : '/bookings/') + fix.booking._id + '/promotion';
            const actor = counter ? employee : member;
            const before = (await User.findById(member.id)).memberPoints;
            assert.equal((await request(path, actor, 'PATCH', { code: p.code })).status, 409, 'No silent removal of applied points');
            assert.equal((await request(path, actor, 'PATCH', { code: 'UNKNOWN', replacePoints: true })).status, 409);
            assert.equal((await Booking.findById(fix.booking._id)).pointsUsed, 20, 'Invalid code rolls back point removal');
            assert.equal((await request(path, actor, 'PATCH', { code: '', replacePoints: true })).status, 400);
            assert.equal((await request(path, actor, 'PATCH', { code: p.code, replacePoints: 'true' })).status, 400);
            const changed = await request(path, actor, 'PATCH', { code: p.code, replacePoints: true });
            assert.equal(changed.status, 200); assert.equal(changed.data.pointsUsed, 0); assert.equal(changed.data.promotion.code, p.code); assert.equal(changed.data.total, 225000);
            assert.equal((await User.findById(member.id)).memberPoints, before, 'Pending changes do not deduct wallet balance');
            assert.equal((await Promotion.findById(p.id)).usedCount, 0);
        }
    });
    await t.test('food edits reprice the code and reject changes below scoped minimum without changing the order', async () => {
        const fix = await fixture(), p = await promo(); await apply(fix, p.code);
        const edit = quantity => request('/bookings/' + fix.booking._id + '/food', member, 'PATCH', { foodItems: [{ food: fix.food.id, quantity }] });
        assert.equal((await edit(3)).data.total, 267500); assert.equal((await edit(1)).status, 409);
        assert.equal((await Booking.findById(fix.booking._id)).foodItems[0].quantity, 3); assert.equal((await Promotion.findById(p.id)).usedCount, 0);
    });
    await t.test('cancelled, expired and provider-locked orders cannot change codes', async () => {
        const p = await promo();
        for (const change of [{ status: 'cancelled' }, { expiresAt: new Date(Date.now() - 1000) }, { activePayment: 'provider-test' }]) {
            const fix = await fixture(); await Booking.updateOne({ _id: fix.booking._id }, { $set: change }); assert.ok([409,410].includes((await apply(fix, p.code)).status));
        }
    });
    await t.test('VNPay uses discounted total, failed attempts do not consume usage and signed success redeems once', async () => {
        const user = await account(), fix = await fixture({ user, points: 20 }), p = await promo(); await apply(fix, p.code);
        const start = () => request('/bookings/' + fix.booking._id + '/pay', user, 'POST', { method: 'vnpay' });
        const first = await start(); assert.equal(first.status, 200);
        assert.equal(new URL(first.data.paymentUrl).searchParams.get('vnp_Amount'), '22500000'); assert.equal((await apply(fix, '')).status, 409);
        async function ipn(reference, success = true) {
            const params = { vnp_TmnCode: process.env.VNPAY_TMN_CODE, vnp_TxnRef: reference, vnp_Amount: '22500000', vnp_ResponseCode: success ? '00' : '24', vnp_TransactionStatus: success ? '00' : '02', vnp_TransactionNo: '123456789' };
            params.vnp_SecureHash = signature(params); return request('/payments/vnpay/ipn?' + new URLSearchParams(params), null);
        }
        assert.equal((await ipn(first.data.reference, false)).data.RspCode, '00'); assert.equal((await Promotion.findById(p.id)).usedCount, 0);
        const second = await start(); assert.equal((await ipn(second.data.reference)).data.RspCode, '00'); assert.equal((await ipn(second.data.reference)).data.RspCode, '02');
        const stored = await Booking.findById(fix.booking._id); assert.equal(stored.status, 'paid'); assert.equal(stored.total, 225000);
        assert.equal((await Promotion.findById(p.id)).usedCount, 1); assert.equal((await User.findById(user.id)).memberPoints, 280); assert.equal((await Food.findById(fix.food.id)).stock, 98);
        const revenue = await RevenueEntry.findOne({ booking: fix.booking._id }); assert.equal(revenue.discounts, 5000); assert.equal(revenue.points, 20000); assert.equal(revenue.amount, 225000);
    });
    await t.test('100% online promotion confirms a zero-total order once without cash/gateway or point deduction', async () => {
        const fix = await fixture(), p = await promo({ value: 100, scope: 'all', minOrder: 0 }); await apply(fix, p.code);
        const before = (await User.findById(member.id)).memberPoints;
        const paid = await payPoints(fix); assert.equal(paid.status, 200); assert.equal(paid.data.status, 'paid'); assert.equal(paid.data.total, 0);
        assert.equal((await payPoints(fix)).status, 200); assert.equal((await Promotion.findById(p.id)).usedCount, 1);
        assert.equal((await User.findById(member.id)).memberPoints, before); assert.equal(await PaymentAttempt.countDocuments({ booking: fix.booking._id, method: { $in: ['cash','vnpay'] } }), 0);
    });
    await t.test('only one competing order can consume the final promotion use', async () => {
        const a = await fixture(), b = await fixture(), p = await promo({ value: 100, scope: 'all', minOrder: 0, usageLimit: 1 });
        await apply(a, p.code); await apply(b, p.code);
        const results = await Promise.all([payPoints(a), payPoints(b)]); assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
        assert.equal((await Promotion.findById(p.id)).usedCount, 1); assert.equal(await Booking.countDocuments({ _id: { $in: [a.booking._id,b.booking._id] }, status: 'paid' }), 1);
    });
    await t.test('expiration and transaction failure at settlement leave points, usage, inventory and tickets unchanged', async () => {
        const fix = await fixture({ points: 200 }), p = await promo({ discountType: 'fixed', value: 50000, scope: 'all', minOrder: 0 }); await apply(fix, p.code);
        const balance = (await User.findById(member.id)).memberPoints;
        const mock = t.mock.method(PaymentAttempt, 'create', () => { throw new Error('Test receipt failure'); });
        try { assert.equal((await payPoints(fix)).status, 500); } finally { mock.mock.restore(); }
        assert.equal((await Promotion.findById(p.id)).usedCount, 0); assert.equal((await User.findById(member.id)).memberPoints, balance); assert.equal((await Food.findById(fix.food.id)).stock, 100);
        assert.equal((await Booking.findById(fix.booking._id)).tickets.length, 0);
        await Promotion.updateOne({ _id: p.id }, { $set: { endsAt: new Date(Date.now() - 1) } }); assert.equal((await payPoints(fix)).status, 409);
        assert.equal((await Promotion.findById(p.id)).usedCount, 0);
    });
});
