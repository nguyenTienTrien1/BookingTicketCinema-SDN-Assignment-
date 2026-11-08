import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from "../../src/app.js";
import User from "../../src/models/users/User.js";
import { startSmtpReceiver, emailedPassword } from "../support/smtp.js";

test('Admin account creation by emailed random password and direct account updates', async t => {
    const dbName = 'cinema_accounts_' + randomUUID().replaceAll('-', '');
    await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
    const smtp = await startSmtpReceiver();
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    t.after(async () => { await new Promise(resolve => server.close(resolve)); await smtp.close(); assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
    await User.init();
    const admin = await User.create({ fullName: 'Admin', email: 'admin@accounts.test', password: randomUUID(), role: 'admin', status: 'Active' });
    const member = await User.create({ fullName: 'Member', email: 'member@accounts.test', password: randomUUID(), role: 'member', status: 'Active' });
    const employee = await User.create({ fullName: 'Employee', email: 'employee@accounts.test', password: randomUUID(), role: 'employee', status: 'Active' });
    const token = actor => jwt.sign({ id: actor.id, tokenVersion: actor.tokenVersion || 0 }, process.env.JWT_SECRET);
    async function request(path, actor = admin, method = 'GET', body, extra = {}) {
        const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Cookie: 'token=' + token(actor) } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, data: await response.json() };
    }
    const payload = (email = randomUUID() + '@accounts.test') => ({ fullName: 'New Employee', email, phone: '0901234567', role: 'employee' });
    const patch = (user, changes = {}) => ({ fullName: user.fullName, email: user.email, phone: user.phone || '', role: user.role, status: user.status, version: user.__v || 0, expectedStatus: user.status, ...changes });
    let created, password, failed;

    await t.test('anonymous, Member and Employee cannot create, update or resend credentials', async () => {
        for (const actor of [null, member, employee]) for (const [path, method, body] of [['/users', 'POST', payload()], ['/users/' + employee.id, 'PATCH', patch(employee)], ['/users/' + employee.id + '/credentials-email', 'POST', {}]]) {
            assert.equal((await request(path, actor, method, body)).status, actor ? 403 : 401);
        }
    });
    await t.test('creates normalized active account, emails unique password and stores only bcrypt hash', async () => {
        const result = await request('/users', admin, 'POST', payload('  NEW@ACCOUNTS.TEST  '));
        assert.equal(result.status, 201, JSON.stringify(result.data)); created = result.data.user;
        assert.equal(result.data.emailSent, true); assert.equal(created.email, 'new@accounts.test'); assert.equal(created.status, 'Active');
        assert.equal(created.role, 'employee'); assert.equal(result.data.activationLink, undefined); assert.equal(result.data.password, undefined);
        password = emailedPassword(smtp.inbox.messages.at(-1));
        const stored = await User.findById(created._id);
        assert.notEqual(stored.password, password); assert.equal(await bcrypt.compare(password, stored.password), true);
        assert.equal(JSON.stringify(result.data).includes(password), false);
        assert.match(smtp.inbox.messages.at(-1), /\/admin\/login/);
        assert.equal((await request('/auth/admin/login', null, 'POST', { email: created.email, password })).status, 200);
        const second = await request('/users', admin, 'POST', { ...payload(), role: 'admin' });
        assert.equal(second.status, 201); assert.equal(second.data.user.role, 'admin'); assert.notEqual(emailedPassword(smtp.inbox.messages.at(-1)), password);
    });
    await t.test('rejects invalid fields, privileged extras, duplicate email and cross-site writes', async () => {
        const before = smtp.inbox.messages.length;
        for (const change of [{ fullName: '' }, { email: 'invalid' }, { phone: '123' }, { role: 'member' }, { password: 'ClientPassword' }, { memberPoints: 900 }, { status: 'Active' }]) assert.equal((await request('/users', admin, 'POST', { ...payload(), ...change })).status, 400);
        assert.equal((await request('/users', admin, 'POST', payload(created.email))).status, 409);
        assert.equal((await request('/users', admin, 'POST', payload(), { Origin: 'https://untrusted.example' })).status, 403);
        assert.equal((await request('/users', admin, 'POST', payload(), { 'Content-Type': 'text/plain' })).status, 415);
        assert.equal(smtp.inbox.messages.length, before);
    });
    await t.test('failed SMTP keeps account pending, retry sends a new password and activates it', async () => {
        smtp.inbox.reject = true;
        const result = await request('/users', admin, 'POST', payload()); failed = result.data.user;
        assert.equal(result.status, 201); assert.equal(result.data.emailSent, false); assert.equal(failed.status, 'Pending Activation');
        assert.equal(failed.credentialsEmailStatus, 'failed');
        const oldHash = (await User.findById(failed._id)).password;
        assert.equal((await request('/users/' + failed._id, admin, 'PATCH', patch(failed, { status: 'Active' }))).status, 400);
        smtp.inbox.reject = false;
        const retry = await request('/users/' + failed._id + '/credentials-email', admin, 'POST', {});
        assert.equal(retry.status, 200); assert.equal(retry.data.emailSent, true); assert.equal(retry.data.user.status, 'Active');
        const retryPassword = emailedPassword(smtp.inbox.messages.at(-1));
        assert.notEqual((await User.findById(failed._id)).password, oldHash);
        assert.equal((await request('/auth/admin/login', null, 'POST', { email: failed.email, password: retryPassword })).status, 200);
        assert.equal((await request('/users/' + failed._id + '/credentials-email', admin, 'POST', {})).status, 409);
    });
    await t.test('concurrent duplicate creation sends only one password email', async () => {
        const before = smtp.inbox.messages.length, data = payload();
        const results = await Promise.all([request('/users', admin, 'POST', data), request('/users', admin, 'POST', data)]);
        assert.deepEqual(results.map(r => r.status).sort(), [201, 409]); assert.equal(smtp.inbox.messages.length, before + 1);
    });
    await t.test('in-flight email cannot be resent or edited concurrently', async () => {
        smtp.inbox.delay = true;
        const data = payload(), pending = request('/users', admin, 'POST', data);
        try {
            for (let attempt = 0; !smtp.inbox.pending.length && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
            assert.ok(smtp.inbox.pending.length, 'SMTP is waiting for acceptance');
            const sending = await User.findOne({ email: data.email });
            assert.equal(sending.status, 'Pending Activation');
            assert.equal((await request('/users/' + sending.id + '/credentials-email', admin, 'POST', {})).status, 409);
            assert.equal((await request('/users/' + sending.id, admin, 'PATCH', patch(sending))).status, 409);
        } finally { smtp.inbox.delay = false; for (const finish of smtp.inbox.pending.splice(0)) finish(); }
        const completed = await pending;
        assert.equal(completed.status, 201); assert.equal(completed.data.emailSent, true);
    });
    await t.test('missing SMTP never reports success or uses development email fallback', async () => {
        const keys = ['SMTP_HOST','SMTP_USER','SMTP_PASS','GMAIL_USER','GMAIL_APP_PASS'];
        const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
        const count = smtp.inbox.messages.length;
        try {
            for (const key of keys) delete process.env[key];
            const result = await request('/users', admin, 'POST', payload());
            assert.equal(result.status, 201); assert.equal(result.data.emailSent, false); assert.equal(result.data.user.status, 'Pending Activation');
            assert.equal(result.data.password, undefined); assert.equal(smtp.inbox.messages.length, count);
        } finally { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    });
    await t.test('updates name, email, phone and staff role without a confirmation token', async () => {
        const result = await request('/users/' + created._id, admin, 'PATCH', patch(created, { fullName: 'Updated Employee', email: 'updated@accounts.test', phone: '', role: 'admin' }));
        assert.equal(result.status, 200, JSON.stringify(result.data)); created = result.data;
        assert.equal(created.fullName, 'Updated Employee'); assert.equal(created.email, 'updated@accounts.test'); assert.equal(created.phone, ''); assert.equal(created.role, 'admin');
        assert.equal(created.password, undefined); assert.equal(created.credentialsEmailRequestId, undefined);
        assert.equal((await request('/auth/admin/login', null, 'POST', { email: created.email, password })).status, 200);
    });
    await t.test('stale updates and duplicate email fail without partial changes', async () => {
        assert.equal((await request('/users/' + created._id, admin, 'PATCH', patch(created, { version: 0 }))).status, 409);
        assert.equal((await request('/users/' + created._id, admin, 'PATCH', patch(created, { fullName: 'Should not save', email: admin.email }))).status, 409);
        assert.equal((await User.findById(created._id)).fullName, 'Updated Employee');
        for (const data of [{ password: 'change' }, { memberPoints: 100 }, { phone: 'bad' }, { status: 'Pending Verification' }]) assert.equal((await request('/users/' + created._id, admin, 'PATCH', { ...patch(created), ...data })).status, 400);
    });
    await t.test('direct status update revokes sessions and preserves audit history', async () => {
        const snapshot = await User.findById(created._id), oldToken = token(snapshot);
        const banned = await request('/users/' + created._id, admin, 'PATCH', patch(snapshot, { status: 'Banned' })); assert.equal(banned.status, 200);
        assert.equal((await request('/auth/me', null, 'GET', undefined, { Cookie: 'token=' + oldToken })).status, 401);
        const active = await request('/users/' + created._id, admin, 'PATCH', patch(banned.data, { status: 'Active' })); assert.equal(active.status, 200);
        const audit = await User.findById(created._id).select('+statusHistory'); assert.equal(audit.statusHistory.length, 2);
        assert.equal((await request('/auth/me', null, 'GET', undefined, { Cookie: 'token=' + oldToken })).status, 401);
    });
    await t.test('cannot disable/demote self, elevate Members or bypass pending credentials', async () => {
        assert.equal((await request('/users/' + admin.id, admin, 'PATCH', patch(admin, { role: 'employee' }))).status, 403);
        assert.equal((await request('/users/' + admin.id, admin, 'PATCH', patch(admin, { status: 'Banned' }))).status, 403);
        assert.equal((await request('/users/' + member.id, admin, 'PATCH', patch(member, { role: 'admin' }))).status, 400);
        smtp.inbox.reject = true;
        const pending = (await request('/users', admin, 'POST', payload())).data.user;
        const banned = await request('/users/' + pending._id, admin, 'PATCH', patch(pending, { status: 'Banned' })); assert.equal(banned.status, 200);
        assert.equal((await request('/users/' + pending._id, admin, 'PATCH', patch(banned.data, { status: 'Active' }))).status, 400);
        smtp.inbox.reject = false;
    });
    await t.test('list never exposes hashes, credentials, activation tokens or internal delivery IDs', async () => {
        const result = await request('/users'); assert.equal(result.status, 200);
        for (const user of result.data) for (const field of ['password','credentialsEmailRequestId','staffActivationHash','verificationToken','tokenVersion']) assert.equal(user[field], undefined);
        assert.equal((await request('/users/not-an-id', admin, 'PATCH', patch(employee))).status, 400);
    });
});
