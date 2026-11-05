import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from './src/app.js';
import User from './src/models/User.js';

test('UC-8 Search Member Information', async (t) => {
    const dbName = `cinema_member_test_${randomUUID().replaceAll('-', '')}`;
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', {
        dbName, serverSelectionTimeoutMS: 5000
    });
    t.after(async () => {
        assert.equal(mongoose.connection.name, dbName);
        try { await mongoose.connection.dropDatabase(); }
        finally { await mongoose.disconnect(); }
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const member = await User.create({ fullName: 'Member A', email: 'member+one@lookup.test', password: randomUUID(), phone: '0901234567', status: 'Active', memberPoints: 30, isVIP: true,
        age: 25, gender: 'Female', lastLogin: new Date('2026-11-01T02:00:00Z'),
        verificationToken: 'PRIVATE-VERIFICATION', verificationExpires: new Date(Date.now() + 600000) });
    const international = await User.create({ fullName: 'Member B', email: 'international@lookup.test', password: randomUUID(), phone: '+84 (902) 345-678', status: 'Banned' });
    const employee = await User.create({ fullName: 'Employee', email: 'employee@lookup.test', password: randomUUID(), role: 'employee', phone: '0901234567' });
    const admin = await User.create({ fullName: 'Admin', email: 'admin@lookup.test', password: randomUUID(), role: 'admin', phone: '0901234567' });
    const inactive = await User.create({ fullName: 'Inactive employee', email: 'inactive@lookup.test', password: randomUUID(), role: 'employee', status: 'Inactive' });
    const inactiveAdmin = await User.create({ fullName: 'Inactive admin', email: 'inactive-admin@lookup.test', password: randomUUID(), role: 'admin', status: 'Inactive' });
    function token(user, claimedRole = 'employee') { return jwt.sign({ id: user._id, role: claimedRole, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302', { expiresIn: '5m' }); }
    async function request(path, session = token(employee)) {
        const response = await fetch(base + path, { headers: session ? { Cookie: `token=${session}` } : {} });
        return { status: response.status, data: await response.json() };
    }
    const searchPath = (query) => '/members/search?q=' + encodeURIComponent(query);
    function assertPermittedFields(row, viewerRole = 'employee') {
        const fields = ['_id', 'email', 'fullName', 'isVIP', 'memberPoints', 'phone', 'status'];
        if (viewerRole === 'admin') fields.push('age', 'gender', 'role', 'createdAt', 'updatedAt', 'lastLogin');
        assert.deepEqual(Object.keys(row).sort(), fields.sort());
        assert.equal(JSON.stringify(row).includes('PRIVATE-VERIFICATION'), false);
    }

    await t.test('only authenticated active Employees and Admins may search and read details', async () => {
        for (const [session, expected] of [[null, 401], ['invalid', 401], [token(inactive), 401], [token(inactiveAdmin), 401], [token(member), 403], [token(admin), 200], [token(employee), 200]]) {
            for (const path of [searchPath(member.email), `/members/${member._id}`]) {
                assert.equal((await request(path, session)).status, expected);
            }
        }
        assert.equal((await request('/users')).status, 403);
    });
    await t.test('Admins receive expanded profile and account activity fields without security data', async () => {
        const search = await request(searchPath(member.email), token(admin));
        assert.equal(search.status, 200);
        assert.equal(search.data.members.length, 1);
        assertPermittedFields(search.data.members[0], 'admin');
        const result = await request(`/members/${member._id}`, token(admin));
        assert.equal(result.status, 200);
        assertPermittedFields(result.data.member, 'admin');
        assert.equal(result.data.member.age, 25);
        assert.equal(result.data.member.gender, 'Female');
        assert.equal(result.data.member.role, 'member');
        assert.equal(result.data.member.lastLogin, '2026-11-01T02:00:00.000Z');
        assert.ok(result.data.member.createdAt);
        assert.ok(result.data.member.updatedAt);
    });
    await t.test('Employee data stays restricted despite spoofed role claims or requested fields', async () => {
        const session = token(employee, 'admin');
        const suffix = '&role=admin&viewerRole=admin&fields=age,password,verificationToken';
        const search = await request(searchPath(member.email) + suffix, session);
        assert.equal(search.status, 200);
        assertPermittedFields(search.data.members[0]);
        const detail = await request(`/members/${member._id}?role=admin&fields=age,password`, session);
        assertPermittedFields(detail.data.member);
        // A previously issued Admin token also follows a later database role downgrade.
        const adminSession = token(admin, 'admin');
        await User.updateOne({ _id: admin._id }, { $set: { role: 'employee' } });
        try {
            const downgraded = await request(`/members/${member._id}`, adminSession);
            assert.equal(downgraded.status, 200);
            assertPermittedFields(downgraded.data.member);
        } finally { await User.updateOne({ _id: admin._id }, { $set: { role: 'admin' } }); }
    });
    await t.test('email search ignores case and ordinary outside whitespace and treats symbols literally', async () => {
        const result = await request(searchPath('  MEMBER+ONE@LOOKUP.TEST  '));
        assert.equal(result.status, 200);
        assert.equal(result.data.members.length, 1);
        assert.equal(result.data.members[0]._id, String(member._id));
        assert.equal(result.data.hasMore, false);
        assertPermittedFields(result.data.members[0]);
        for (const value of ['member@lookup.test', 'member.*@lookup.test', '.*@lookup.test', 'missing@lookup.test']) {
            assert.deepEqual((await request(searchPath(value))).data, { members: [], hasMore: false });
        }
    });
    await t.test('phone formats and Vietnamese country prefixes match only the complete number', async () => {
        for (const value of ['0901234567', '0901 234 567', '(0901)234-567', '+84 901 234 567', '84901234567', '0084 901 234 567']) {
            const result = await request(searchPath(value));
            assert.equal(result.status, 200);
            assert.deepEqual(result.data.members.map((row) => row._id), [String(member._id)]);
        }
        for (const value of ['0902345678', '+84 (902) 345-678', '0084902345678']) {
            const result = await request(searchPath(value));
            assert.equal(result.data.members[0]._id, String(international._id));
            assert.equal(result.data.members[0].status, 'Banned');
        }
        assert.deepEqual((await request(searchPath('901234567'))).data.members, []);
    });
    await t.test('staff accounts are excluded from lookup results and detail access', async () => {
        for (const viewer of [employee, admin]) {
            for (const user of [employee, admin]) {
                assert.deepEqual((await request(searchPath(user.email), token(viewer))).data.members, []);
                assert.equal((await request(`/members/${user._id}`, token(viewer))).status, 404);
            }
        }
    });
    await t.test('missing, malformed, oversized and structured queries are rejected', async () => {
        const paths = ['/members/search', '/members/search?q[$ne]=x', '/members/search?q=a&q=b'];
        for (const query of ['', ' ', 'abc', 'bad@', '0901.*', '+', '123', '1'.repeat(255), '0 '.repeat(40)]) paths.push(searchPath(query));
        for (const path of paths) assert.equal((await request(path)).status, 400, path);
        assert.equal((await request('/members/not-an-id')).status, 400);
        assert.equal((await request(`/members/${new mongoose.Types.ObjectId()}`)).status, 404);
    });
    await t.test('selecting a member reads fresh permitted details without changing accounts', async () => {
        await User.updateOne({ _id: member._id }, { $set: { memberPoints: 45, status: 'Inactive' } });
        const before = JSON.stringify(await User.find().sort({ _id: 1 }).lean());
        await request(searchPath(member.email));
        const result = await request(`/members/${member._id}`);
        assert.equal(result.status, 200);
        assert.equal(result.data.member.memberPoints, 45);
        assert.equal(result.data.member.status, 'Inactive');
        assertPermittedFields(result.data.member);
        assert.equal(JSON.stringify(await User.find().sort({ _id: 1 }).lean()), before);
    });
    await t.test('ambiguous phone matches are bounded and all matching members can be found by email', async () => {
        await User.collection.insertMany(Array.from({ length: 21 }, (_, index) => ({
            fullName: `Duplicate ${String(index).padStart(2, '0')}`, email: `duplicate${index}@lookup.test`,
            password: member.password, role: 'member', status: 'Active', phone: '0911111111', memberPoints: 0, isVIP: false
        })));
        const result = await request(searchPath('0911111111'));
        assert.equal(result.data.members.length, 20);
        assert.equal(result.data.hasMore, true);
        assert.equal(result.data.members[0].fullName, 'Duplicate 00');
        const exact = await request(searchPath('duplicate20@lookup.test'));
        assert.equal(exact.data.members.length, 1);
        assert.equal(exact.data.hasMore, false);
    });
    await t.test('failed reads return errors without leaking database details', async () => {
        for (const [method, path] of [['find', searchPath(member.email)], ['findOne', `/members/${member._id}`]]) {
            const original = User[method];
            const mocked = t.mock.method(User, method, function (filter, ...args) {
                // Keep the session middleware's account lookup working.
                if (method === 'findOne' && filter.role !== 'member') return original.call(this, filter, ...args);
                throw new Error('Private member database failure');
            });
            try {
                const result = await request(path);
                assert.equal(result.status, 500);
                assert.equal(JSON.stringify(result.data).includes('Private member'), false);
            } finally { mocked.mock.restore(); }
        }
    });
});
