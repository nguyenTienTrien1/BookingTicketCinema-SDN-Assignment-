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
import app from '../../src/app.js';
import User from '../../src/models/users/User.js';
import Movie from '../../src/models/movies/Movie.js';
import { MOVIE_IMAGE_DIRECTORY } from '../../src/services/catalogue/foodImageService.js';

test('Admin uploads movie poster and banner, replaces images and Member sees saved artwork', async (t) => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const dbName = `cinema_movie_image_ui_${randomUUID().replaceAll('-', '')}`;
  const images = [];
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema', { dbName, serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    for (const image of images) {
      assert.match(image, /^\/api\/uploads\/movies\/[0-9a-f-]{36}\.webp$/);
      await unlink(path.join(MOVIE_IMAGE_DIRECTORY, path.basename(image)));
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
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let uploads = 0;
  page.on('request', request => { if (request.url().endsWith('/api/movies/images')) uploads++; });
  const poster = await sharp({ create: { width: 400, height: 600, channels: 3, background: '#c91836' } }).png().toBuffer();
  const banner = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#176b61' } }).jpeg().toBuffer();
  async function choose(kind, name, mimeType, buffer) {
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: `Chọn ${kind} từ máy tính`, exact: true }).click();
    await (await chooserPromise).setFiles({ name, mimeType, buffer });
  }
  async function save() {
    const uploaded = [];
    const track = async response => {
      if (response.url().endsWith('/api/movies/images') && response.status() === 201) {
        const image = (await response.json()).image; images.push(image); uploaded.push(image);
      }
    };
    page.on('response', track);
    await page.getByRole('button', { name: 'Lưu phim', exact: true }).click();
    await page.waitForURL(base + '/admin/movies');
    page.off('response', track);
    return uploaded;
  }
  // Validate the real upload endpoint, including auth and raw-file checks.
  const member = await User.create({ fullName: 'Movie Image Member', email: 'member@movie-image.test', password, role: 'member', status: 'Active' });
  const memberContext = await browser.newContext();
  assert.equal((await memberContext.request.post(base + '/api/auth/login', { data: { email: member.email, password } })).status(), 200);
  assert.equal((await memberContext.request.post(base + '/api/movies/images', { headers: { 'Content-Type': 'image/png' }, data: poster })).status(), 403);
  assert.equal((await context.request.post(base + '/api/movies/images', { headers: { 'Content-Type': 'image/png', Origin: 'https://untrusted.example' }, data: poster })).status(), 403);
  for (const [type, data, status] of [['image/svg+xml', '<svg/>', 415], ['image/png', 'not an image', 400], ['image/jpeg', poster, 400], ['image/png', Buffer.alloc(5 * 1024 * 1024 + 1), 413]]) {
    assert.equal((await context.request.post(base + '/api/movies/images', { headers: { 'Content-Type': type }, data })).status(), status);
  }
  await page.goto(base + '/admin/movies/new');
  await page.locator('#movie-title').waitFor().catch(async error => {
    console.error('Movie upload page:', page.url(), (await page.locator('body').innerText()).slice(0, 1800), errors);
    throw error;
  });
  // Use a known seed title to catch any hard-coded poster override on Member pages.
  await page.locator('#movie-title').fill('Dune');
  await page.locator('#movie-description').fill('Movie upload verification');
  await page.locator('#movie-genre').fill('Action');
  await page.locator('#movie-duration').fill('120');
  await page.locator('#movie-classification').selectOption('P');
  await page.locator('#movie-release').fill('2020-01-01');
  await choose('poster', 'invalid.txt', 'text/plain', Buffer.from('invalid'));
  await page.getByRole('alert').filter({ hasText: 'tối đa 5 MB' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Lưu phim', exact: true }).isDisabled(), true);
  await choose('poster', 'poster.png', 'image/png', poster);
  await choose('banner', 'banner.jpg', 'image/jpeg', banner);
  await page.waitForFunction(() => [...document.querySelectorAll('.movieImagePreview img')].length === 2 && [...document.querySelectorAll('.movieImagePreview img')].every(img => img.src.startsWith('blob:') && img.naturalWidth > 0));
  assert.equal(uploads, 0, 'Preview does not upload before Save');
  const artifacts = path.join(root, '.local/qa/movie-images');
  await mkdir(artifacts, { recursive: true });
  await page.screenshot({ path: path.join(artifacts, 'movie-upload-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, 'movie-upload-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1366, height: 1000 });
  await save();
  let movie = await Movie.findOne({ title: 'Dune' });
  assert.match(movie.poster, /^\/api\/uploads\/movies\/[0-9a-f-]{36}\.webp$/);
  assert.match(movie.banner, /^\/api\/uploads\/movies\/[0-9a-f-]{36}\.webp$/);
  const originalPoster = movie.poster, originalBanner = movie.banner;
  for (const image of [originalPoster, originalBanner]) {
    const response = await memberContext.request.get(base + image);
    assert.equal(response.status(), 200); assert.match(response.headers()['content-type'], /image\/webp/);
    assert.equal(response.headers()['x-content-type-options'], 'nosniff');
  }
  await page.goto(base + '/admin/movies/' + movie.id + '/edit');
  await page.waitForFunction(() => [...document.querySelectorAll('.movieImagePreview img')].length === 2 && [...document.querySelectorAll('.movieImagePreview img')].every(img => img.naturalWidth > 0));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.movieImagePicker-poster img')?.naturalWidth > 0);
  await choose('poster', 'replacement.webp', 'image/webp', await sharp(banner).webp().toBuffer());
  await save();
  movie = await Movie.findById(movie.id);
  assert.notEqual(movie.poster, originalPoster);
  assert.equal(movie.banner, originalBanner, 'Unchanged banner survives editing');
  assert.equal(uploads, 3);
  const memberPage = await memberContext.newPage();
  memberPage.on('pageerror', error => errors.push(error.message));
  await memberPage.goto(base + '/');
  const memberPoster = memberPage.locator(`img[src="${base + movie.poster}"]`).first();
  await memberPoster.waitFor();
  await memberPoster.scrollIntoViewIfNeeded();
  await memberPage.waitForFunction(src => [...document.images].some(img => img.src === src && img.naturalWidth > 0), base + movie.poster);
  const sources = await memberPage.evaluate(async () => {
    const { getMovies } = await import('/src/services/movieService.js');
    const { getMoviePoster } = await import('/src/components/MovieCard.jsx');
    const movie = (await getMovies())[0];
    return { poster: getMoviePoster(movie), banner: movie.banner };
  });
  assert.equal(sources.poster, base + movie.poster);
  assert.equal(sources.banner, base + movie.banner);
  await memberPage.locator('.cinematicMovieCard').filter({ has: memberPage.locator(`img[src="${base + movie.poster}"]`) }).first().getByRole('button', { name: 'Chi tiết', exact: true }).click();
  await memberPage.locator('.detailHeroSection').waitFor();
  assert.ok((await memberPage.locator('.detailHeroSection').getAttribute('style')).includes(base + movie.banner), 'Movie detail renders the uploaded banner');
  await memberPage.screenshot({ path: path.join(artifacts, 'member-movie-images.png'), fullPage: true });
  await page.goto(base + '/admin/movies/new');
  await choose('poster', 'cancelled.png', 'image/png', poster);
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.waitForURL(base + '/admin/movies');
  assert.equal(uploads, 3, 'Cancel does not upload a file');
  assert.equal(await Movie.countDocuments(), 1);
  assert.deepEqual(errors, []);
});
