import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Food from '../src/models/Food.js';
import { FOOD_IMAGE_DIRECTORY } from '../src/services/foodImageService.js';

test('Admin chooses a local F&B image, previews, saves, reloads and replaces it', async (t) => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const dbName = `cinema_food_image_ui_${randomUUID().replaceAll('-', '')}`;
  const images = [];
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    for (const image of images) {
      assert.match(image, /^\/api\/uploads\/foods\/[0-9a-f-]{36}\.webp$/);
      await unlink(path.join(FOOD_IMAGE_DIRECTORY, path.basename(image)));
    }
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const password = randomUUID();
  await User.create({ fullName: 'Image Admin', email: 'admin@image-ui.test', password, role: 'admin', status: 'Active' });
  const api = app.listen(0, '127.0.0.1');
  await once(api, 'listening');
  t.after(() => new Promise((resolve) => api.close(resolve)));
  const vite = await createServer({ root: path.join(root, 'frontend'), configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api'), 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') },
    server: { host: '127.0.0.1', port: 0, proxy: { '/api': `http://127.0.0.1:${api.address().port}` } } });
  await vite.listen();
  t.after(() => vite.close());
  const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const previousOrigin = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = base;
  t.after(() => { if (previousOrigin === undefined) delete process.env.CORS_ORIGIN; else process.env.CORS_ORIGIN = previousOrigin; });
  const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  const login = await context.request.post(base + '/api/auth/admin/login', { data: { email: 'admin@image-ui.test', password } });
  assert.equal(login.status(), 200);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  let uploadCount = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (request.url().endsWith('/api/foods/images')) uploadCount++; });
  const png = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#c91836' } }).png().toBuffer();
  const jpeg = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#176b61' } }).jpeg().toBuffer();
  async function choose(name, mimeType, buffer) {
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Chọn ảnh từ máy tính' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({ name, mimeType, buffer });
  }
  async function saveImage() {
    const result = page.waitForResponse((response) => response.url().endsWith('/api/foods/images') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    const response = await result;
    assert.equal(response.status(), 201);
    const { image } = await response.json();
    images.push(image);
    await page.waitForURL(base + '/admin/foods');
    await page.getByRole('status').filter({ hasText: /Đã thêm|Đã cập nhật/ }).waitFor();
    return image;
  }
  await page.goto(base + '/admin/foods/new');
  await page.locator('#catalogue-name').fill('Local Image Product');
  await page.locator('#food-price').fill('35000');
  await page.locator('#food-stock').fill('10');
  await choose('invalid.txt', 'text/plain', Buffer.from('Not an image'));
  await page.getByRole('alert').filter({ hasText: 'tối đa 5 MB' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Lưu', exact: true }).isDisabled(), true);
  assert.equal(uploadCount, 0);
  await page.getByRole('button', { name: 'Bỏ chọn', exact: true }).click();
  await choose('popcorn.png', 'image/png', png);
  await page.waitForFunction(() => document.querySelector('.foodImagePreview img')?.src.startsWith('blob:') && document.querySelector('.foodImagePreview img').naturalWidth > 0);
  assert.equal(uploadCount, 0, 'Selecting an image does not upload it before saving');
  const firstImage = await saveImage();
  let product = await Food.findOne({ name: 'Local Image Product' });
  assert.equal(product.image, firstImage);
  await page.getByRole('link', { name: 'Sửa Local Image Product', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.foodImagePreview img')?.naturalWidth > 0);
  assert.ok((await page.locator('.foodImagePreview img').getAttribute('src')).endsWith(firstImage));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.foodImagePreview img')?.naturalWidth > 0);
  await choose('drink.jpg', 'image/jpeg', jpeg);
  const secondImage = await saveImage();
  product = await Food.findById(product._id);
  assert.equal(product.image, secondImage);
  assert.notEqual(secondImage, firstImage);
  assert.equal((await context.request.get(base + firstImage)).status(), 200, 'Replacing an image does not delete a potentially shared asset');
  await page.getByRole('link', { name: 'Sửa Local Image Product', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.foodImagePreview img')?.naturalWidth > 0);
  await page.setViewportSize({ width: 390, height: 844 });
  const artifacts = path.join(root, '.local', 'qa', 'food-images');
  await mkdir(artifacts, { recursive: true });
  await page.screenshot({ path: path.join(artifacts, 'picker-mobile.png'), fullPage: true });
  await page.goto(base + '/admin/foods/new');
  await choose('cancelled.png', 'image/png', png);
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.waitForURL(base + '/admin/foods');
  assert.equal(uploadCount, 2);
  assert.equal(await Food.countDocuments(), 1);
  assert.deepEqual(errors, []);
});
