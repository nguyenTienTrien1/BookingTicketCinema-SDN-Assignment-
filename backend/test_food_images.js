import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import app from './src/app.js';
import User from './src/models/User.js';
import Food from './src/models/Food.js';
import { FOOD_IMAGE_DIRECTORY, MAX_IMAGE_BYTES } from './src/services/foodImageService.js';

test('F&B local image selection and upload', async (t) => {
  const dbName = `cinema_image_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const uploads = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const image of uploads) {
      assert.match(image, /^\/api\/uploads\/foods\/[0-9a-f-]{36}\.webp$/);
      await unlink(path.join(FOOD_IMAGE_DIRECTORY, path.basename(image)));
    }
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const admin = await User.create({ fullName: 'Admin', email: 'admin@image.test', password: randomUUID(), role: 'admin' });
  const member = await User.create({ fullName: 'Member', email: 'member@image.test', password: randomUUID(), role: 'member', status: 'Active' });
  const employee = await User.create({ fullName: 'Employee', email: 'employee@image.test', password: randomUUID(), role: 'employee' });
  function cookie(user) {
    return 'token=' + jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecret_cinema_jwt_key_2026_sdn302');
  }
  async function upload(data, type, user = admin, extraHeaders = {}) {
    const headers = { 'Content-Type': type, ...extraHeaders };
    if (user) headers.Cookie = cookie(user);
    const response = await fetch(base + '/api/foods/images', { method: 'POST', headers, body: data });
    const result = { status: response.status, data: await response.json() };
    if (result.status === 201) uploads.push(result.data.image);
    return result;
  }
  const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#c91836' } }).png().toBuffer();
  let image;
  await t.test('only active Admin can upload; cross-origin uploads are rejected', async () => {
    assert.equal((await upload(png, 'image/png', null)).status, 401);
    for (const user of [member, employee]) assert.equal((await upload(png, 'image/png', user)).status, 403);
    assert.equal((await upload(png, 'image/png', admin, { Origin: 'https://untrusted.example' })).status, 403);
    await User.updateOne({ _id: admin._id }, { $set: { status: 'Inactive' } });
    assert.equal((await upload(png, 'image/png')).status, 401);
    await User.updateOne({ _id: admin._id }, { $set: { status: 'Active' } });
  });
  await t.test('PNG, JPEG and WebP are decoded, normalized and publicly retrievable', async () => {
    for (const [buffer, mime] of [[png, 'image/png'], [await sharp(png).jpeg().toBuffer(), 'image/jpeg'], [await sharp(png).webp().toBuffer(), 'image/webp']]) {
      const result = await upload(buffer, mime);
      assert.equal(result.status, 201, JSON.stringify(result.data));
      image = result.data.image;
      assert.match(image, /^\/api\/uploads\/foods\/[0-9a-f-]{36}\.webp$/);
      const response = await fetch(base + image);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/webp');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, 300);
    }
    assert.equal(new Set(uploads).size, 3);
  });
  await t.test('fake images, SVG, mismatched MIME, empty content and oversized uploads are rejected', async () => {
    assert.equal((await upload('<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml')).status, 415);
    assert.equal((await upload('<script>alert(1)</script>', 'image/png')).status, 400);
    assert.equal((await upload(png, 'image/jpeg')).status, 400);
    assert.equal((await upload(png.subarray(0, 30), 'image/png')).status, 400);
    assert.equal((await upload(Buffer.alloc(0), 'image/png')).status, 400);
    assert.equal((await upload(Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image/png')).status, 413);
    assert.equal((await fetch(base + '/api/uploads/foods/not-an-image.txt')).status, 404);
    assert.equal((await fetch(base + `/api/uploads/foods/${randomUUID()}.webp`)).status, 404);
  });
  await t.test('large dimensions are constrained and unsafe pixel counts are rejected', async () => {
    const wide = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const result = await upload(wide, 'image/png');
    assert.equal(result.status, 201);
    const response = await fetch(base + result.data.image);
    const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    assert.equal(meta.width, 1600);
    assert.equal(meta.height, 800);
    const huge = await sharp({ create: { width: 4500, height: 4500, channels: 3, background: '#ffffff' } }).png().toBuffer();
    assert.equal((await upload(huge, 'image/png')).status, 400);
  });
  await t.test('uploaded path survives product creation, editing and reload', async () => {
    const body = { name: 'Image Product', price: 35000, stock: 10, available: true, image };
    const create = await fetch(base + '/api/foods', { method: 'POST', headers: { Cookie: cookie(admin), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(create.status, 201);
    const product = await create.json();
    assert.equal((await Food.findById(product._id)).image, image);
    const edit = await fetch(base + `/api/foods/${product._id}`, { method: 'PUT', headers: { Cookie: cookie(admin), 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, name: 'Edited Image Product', version: product.__v }) });
    assert.equal(edit.status, 200);
    const reload = await fetch(base + `/api/foods/admin/${product._id}`, { headers: { Cookie: cookie(admin) } });
    assert.equal((await reload.json()).image, image);
    assert.equal((await fetch(base + image)).status, 200);
  });
});
