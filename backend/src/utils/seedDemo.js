import 'dotenv/config';
import mongoose from 'mongoose';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import User from '../models/User.js';
import Movie from '../models/Movie.js';
import CinemaRoom, { seatConfiguration } from '../models/CinemaRoom.js';
import Showtime from '../models/Showtime.js';
import Food from '../models/Food.js';
import Promotion from '../models/Promotion.js';
import Booking from '../models/Booking.js';
import { prepareDemoTickets } from '../services/ticketService.js';
import { movieDataset } from '../../seedMovies.js';

// Add fixtures without deleting data, resetting passwords, or changing sold seats.
const DAY = 86400000;
const now = new Date();
const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const midnight = new Date(`${day}T00:00:00+07:00`);
const accounts = [
  ['admin', 'Demo Admin', 0, 'Active'],
  ['employee', 'Demo Employee', 0, 'Active'],
  ['member', 'Demo Member', 300, 'Active'],
  ['vip', 'Demo VIP Member', 1200, 'Active'],
  ['pending', 'Demo Pending Member', 0, 'Pending Verification'],
  ['banned', 'Demo Banned Member', 0, 'Banned'],
];

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema');
  const users = {};
  for (const [key, fullName, memberPoints, status] of accounts) {
    const email = `demo.${key}@cinema.test`;
    users[key] = await User.findOne({ email }) || await User.create({
      email, fullName, password: 'Demo123456!', role: ['admin', 'employee'].includes(key) ? key : 'member',
      memberPoints, status, age: 25, verifiedAge: 25, isVIP: key === 'vip',
      phone: `090000000${accounts.findIndex(a => a[0] === key)}`,
    });
  }

  const movies = [];
  // Use existing local artwork and the project's matching trailer URLs.
  for (const [index, data] of movieDataset.filter(m => m.trailer).entries()) {
    for (const asset of [data.poster, data.banner]) {
      if (!existsSync(fileURLToPath(new URL(`../../../frontend/public${asset}`, import.meta.url)))) {
        throw new Error(`Missing movie asset: ${asset}`);
      }
    }
    let movie = await Movie.findOne({ title: data.title, deletedAt: null });
    if (!movie) movie = await Movie.create({ ...data,
      classification: data.ageLimit >= 18 ? 'T18' : data.ageLimit >= 16 ? 'T16' : data.ageLimit >= 13 ? 'T13' : 'P',
      status: index < 9 ? 'now-showing' : 'coming-soon',
      releaseDate: new Date(midnight.getTime() + (index < 9 ? -14 : 14) * DAY),
      createdBy: users.admin._id,
    });
    else {
      for (const field of ['poster', 'banner', 'trailer', 'description']) if (!movie[field]) movie[field] = data[field];
      if (!movie.classification) movie.classification = movie.ageLimit >= 18 ? 'T18' : movie.ageLimit >= 16 ? 'T16' : movie.ageLimit >= 13 ? 'T13' : 'P';
      await movie.save();
    }
    movies.push(movie);
  }

  const rooms = [];
  for (const cinema of ['Demo Cinema Central', 'Demo Cinema Riverside']) {
    for (let index = 0; index < 4; index++) {
      const name = ['Room 1 Standard', 'Room 2 VIP', 'Room 3 Maintenance', 'Room 4 Inactive'][index];
      let room = await CinemaRoom.findOne({ cinema, name });
      if (!room) {
        const seats = Array.from({ length: index === 1 ? 48 : 80 }, (_, i) => `${String.fromCharCode(65 + Math.floor(i / 8))}${i % 8 + 1}`);
        const seatConfigs = Object.fromEntries(seats.map(number => [number, {
          type: index === 1 || /^[EFG]/.test(number) ? 'VIP' : 'Standard',
          status: number === 'A1' ? 'Broken' : number === 'A2' ? 'Maintenance' : number === 'A3' ? 'Disabled' : 'Active',
        }]));
        room = await CinemaRoom.create({ cinema, name, seats, seatConfigs,
          status: ['Active', 'Active', 'Maintenance', 'Inactive'][index], lastModifiedBy: users.admin._id });
      }
      rooms.push(room);
    }
  }

  const foods = [];
  for (const [name, image, price, stock] of [
    ['Demo Combo Couple', 'combo_couple', 89000, 100], ['Demo Combo Family', 'combo_family', 159000, 60],
    ['Demo Popcorn Cheese', 'popcorn_cheese', 49000, 150], ['Demo Coca Cola', 'coca_cola', 29000, 200],
    ['Demo Pepsi Low Stock', 'pepsi', 29000, 2], ['Demo Dasani Out of Stock', 'dasani', 19000, 0],
  ]) {
    foods.push(await Food.findOne({ name, deletedAt: null }) || await Food.create({ name,
      nameKey: name.toLowerCase(), description: 'Demo fixture - popcorn and drinks',
      image: `/assets/foods/${image}.png`, price, stock, available: stock > 0, createdBy: users.admin._id }));
  }
  for (const [code, scope, discountType, value, minOrder] of [
    ['DEMO10', 'all', 'percentage', 10, 100000], ['DEMOFOOD20', 'food', 'percentage', 20, 50000],
    ['DEMOTICKET30K', 'ticket', 'fixed', 30000, 160000],
  ]) {
    if (!await Promotion.exists({ code })) await Promotion.create({ code, name: `Demo ${code}`, scope,
      description: 'Demo promotion', discountType, value, minOrder, maxDiscount: 50000,
      stackable: false, startsAt: new Date(now.getTime() - DAY), endsAt: new Date(now.getTime() + 30 * DAY),
      usageLimit: 1000, createdBy: users.admin._id });
  }

  const showing = movies.filter(m => m.status === 'now-showing');
  if (!showing.length) throw new Error('No now-showing movies available.');
  const shows = [];
  for (const [roomIndex, room] of rooms.filter(r => r.status === 'Active').entries()) {
    for (let d = 0; d < 7; d++) for (const [slot, hour] of [9, 13, 17, 21].entries()) {
      const startTime = new Date(midnight.getTime() + d * DAY + hour * 3600000);
      if (startTime <= now) continue;
      const movie = showing[(d + slot + roomIndex) % showing.length];
      let show = await Showtime.findOne({ roomId: room._id, startTime });
      if (!show) show = await Showtime.create({ movie: movie._id, roomId: room._id,
        cinema: room.cinema, room: room.name, startTime, price: roomIndex % 2 ? 120000 : 80000,
        seats: room.seats.map(number => { const config = seatConfiguration(room, number);
          return { number, type: config.type, condition: config.status, status: 'available' }; }),
      });
      shows.push(show);
    }
  }

  // Mock receipts deliberately remain demo tickets: they are excluded from real revenue/admission.
  for (const [index, status] of ['paid', 'cancelled', 'pending'].entries()) {
    const paymentRef = `DEMO-SEED-${day}-${status}`;
    if (await Booking.exists({ paymentRef })) continue;
    const show = shows[index];
    if (!show) continue;
    const seats = show.seats.filter(s => s.condition === 'Active' && s.status === 'available').slice(0, 2);
    if (seats.length !== 2) continue;
    const subtotal = show.price * 2 + foods[0].price;
    const booking = await Booking.create({ user: users.member._id, showtime: show._id,
      seats: seats.map(s => s.number), ticketPrice: show.price,
      foodItems: [{ food: foods[0]._id, name: foods[0].name, unitPrice: foods[0].price, quantity: 1 }],
      subtotal, total: subtotal, status, paymentStatus: status === 'paid' ? 'paid' : 'unpaid',
      paymentMethod: 'mock', paymentRef, ticketMode: 'demo',
      paidAt: status === 'paid' ? now : undefined, expiresAt: new Date(now.getTime() + 10 * 60000) });
    if (status !== 'cancelled') {
      for (const seat of seats) {
        seat.status = status === 'paid' ? 'booked' : 'held';
        seat.bookingId = booking._id;
        if (status === 'pending') seat.holdUntil = booking.expiresAt;
      }
      await show.save();
      if (status === 'paid') { Object.assign(booking, await prepareDemoTickets(booking)); await booking.save(); }
    }
  }
  console.log(JSON.stringify({ movies: movies.length, rooms: rooms.length, showtimes: shows.length,
    foods: foods.length, promotions: 3, demoBookingIds: await Booking.find({ paymentRef: /^DEMO-SEED-/ }).distinct('_id') }, null, 2));
  console.log('Accounts: demo.{admin,employee,member,vip,pending,banned}@cinema.test | New account password: Demo123456!');
}

try { await seed(); }
catch (error) { console.error('Demo seed failed:', error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
