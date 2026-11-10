import 'dotenv/config';
import mongoose from 'mongoose';
import { writeFile } from 'node:fs/promises';

// Read-only audit. Never repair payment, inventory or historical data by guessing.
await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
try {
  const db = mongoose.connection.db;
  const names = ['movies', 'showtimes', 'bookings', 'foods', 'users', 'cinemarooms', 'paymentattempts'];
  const data = Object.fromEntries(await Promise.all(names.map(async name => [name, await db.collection(name).find({}).toArray()])));
  const index = name => new Map(data[name].map(item => [String(item._id), item]));
  const movies = index('movies'), shows = index('showtimes'), bookings = index('bookings'), users = index('users');
  const issues = [];
  const add = (type, id, detail) => issues.push({ type, id: String(id), detail });
  const now = new Date();
  for (const food of data.foods) {
    if (!Number.isSafeInteger(food.stock) || food.stock < 0) add('food-stock', food._id, food.stock);
    if (!Number.isSafeInteger(food.price) || food.price < 0) add('food-price', food._id, food.price);
  }
  for (const user of data.users) {
    if (user.role === 'member' && (!Number.isFinite(user.memberPoints) || user.memberPoints < 0)) add('member-points', user._id, user.memberPoints);
  }
  for (const show of data.showtimes) {
    const movie = movies.get(String(show.movie));
    if (!movie) add('show-missing-movie', show._id, String(show.movie));
    if (!Number.isSafeInteger(show.price) || show.price <= 0) add('show-price', show._id, show.price);
    if (new Set(show.seats.map(s => s.number)).size !== show.seats.length) add('duplicate-seats', show._id, 'Seat numbers must be unique');
    for (const seat of show.seats) {
      if (seat.status === 'available') {
        if (seat.bookingId || seat.holdUntil) add('available-seat-owner', show._id, seat.number);
        continue;
      }
      const booking = bookings.get(String(seat.bookingId));
      if (!booking || String(booking.showtime) !== String(show._id) || !booking.seats.includes(seat.number)) {
        add('seat-missing-booking', show._id, seat.number); continue;
      }
      if (seat.status === 'held' && (booking.status !== 'pending' || booking.expiresAt <= now)) add('stale-hold', show._id, seat.number);
      if (seat.status === 'booked' && !['paid', 'refund-requested', 'refunded'].includes(booking.status)) add('booked-seat-status', show._id, seat.number);
    }
    if (show.startTime > now && !show.cancelledAt) {
      if (movie?.deletedAt || movie?.classification === 'C') add('unsellable-show', show._id, movie?.title);
      const room = data.cinemarooms.find(room => String(room._id) === String(show.roomId) || (room.cinema === show.cinema && room.name === show.room));
      if (!room) add('show-missing-room', show._id, `${show.cinema} / ${show.room}`);
      else if (room.status !== 'Active') add('show-inactive-room', show._id, room.status);
    }
  }
  for (const booking of data.bookings) {
    const show = shows.get(String(booking.showtime));
    if (!show) add('booking-missing-show', booking._id, String(booking.showtime));
    if (booking.user && !users.has(String(booking.user))) add('booking-missing-user', booking._id, String(booking.user));
    const foodTotal = (booking.foodItems || []).reduce((sum, food) => sum + food.unitPrice * food.quantity, 0);
    if (!Number.isFinite(booking.ticketPrice) || (booking.foodItems || []).some(food => !Number.isFinite(food.unitPrice) || !Number.isSafeInteger(food.quantity) || food.quantity < 1)) add('booking-missing-price-snapshot', booking._id, 'Historical ticket or food unit price is missing; current catalogue prices cannot prove the original price');
    else if (booking.subtotal !== booking.ticketPrice * booking.seats.length + foodTotal) add('booking-subtotal', booking._id, { actual: booking.subtotal, expected: booking.ticketPrice * booking.seats.length + foodTotal });
    if (booking.discount !== (booking.pointsUsed || 0) * 1000 || booking.total !== booking.subtotal - (booking.discount || 0) - (booking.promotionDiscount || 0) || booking.total < 0) add('booking-total', booking._id, 'Discount or total does not match its snapshots');
    if (booking.status === 'paid') {
      if (booking.paymentStatus !== 'paid') add('paid-payment-status', booking._id, booking.paymentStatus);
      if (booking.tickets?.length !== booking.seats.length || new Set(booking.tickets?.map(t => t.seat)).size !== booking.seats.length || booking.tickets?.some(t => !booking.seats.includes(t.seat))) add('paid-ticket-seats', booking._id, 'Issued tickets must match purchased seats');
      for (const number of booking.seats) {
        if (!show?.seats.some(seat => seat.number === number && seat.status === 'booked' && String(seat.bookingId) === String(booking._id))) add('paid-seat-owner', booking._id, number);
      }
    }
  }
  const future = data.showtimes.filter(show => !show.cancelledAt && show.startTime > now).sort((a,b) => a.startTime - b.startTime);
  for (let i = 0; i < future.length; i++) {
    const a = future[i], duration = movies.get(String(a.movie))?.duration;
    for (let j = i + 1; j < future.length; j++) {
      const b = future[j];
      if (a.cinema === b.cinema && a.room === b.room && b.startTime < new Date(a.startTime.getTime() + (duration + 15) * 60000)) add('overlapping-shows', a._id, String(b._id));
    }
  }
  const report = { auditedAt: now.toISOString(), database: db.databaseName, counts: Object.fromEntries(names.map(name => [name, data[name].length])), upcomingShowtimes: future.length, movieSchedules: data.movies.filter(movie => !movie.deletedAt).map(movie => ({ id: String(movie._id), title: movie.title, status: movie.status, upcoming: future.filter(show => String(show.movie) === String(movie._id)).length })), issueCount: issues.length, issueCounts: issues.reduce((counts, issue) => ({ ...counts, [issue.type]: (counts[issue.type] || 0) + 1 }), {}), issues };
  const output = process.argv[2];
  if (output) await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await mongoose.disconnect();
}
