import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import Food from '../models/Food.js';
import User from '../models/User.js';

const SEAT_HOLD_MINUTES = 10;
const POINT_VALUE = 1000;

function bookingError(message, status) {
  return Object.assign(new Error(message), { status });
}

async function releaseExpiredSeats(showtimeId, now = new Date()) {
  await Showtime.updateOne(
    { _id: showtimeId },
    {
      $set: {
        'seats.$[seat].status': 'available',
        'seats.$[seat].holdUntil': null,
        'seats.$[seat].bookingId': null
      }
    },
    {
      arrayFilters: [{ 'seat.status': 'held', 'seat.holdUntil': { $lte: now } }]
    }
  );

  await Booking.updateMany(
    { showtime: showtimeId, status: 'pending', expiresAt: { $lte: now } },
    { $set: { status: 'cancelled', paymentStatus: 'failed' } }
  );
}

async function releaseBookingSeats(showtimeId, bookingId, seats, status = 'available', holdUntil = null) {
  await Showtime.updateOne(
    { _id: showtimeId },
    {
      $set: {
        'seats.$[seat].status': status,
        'seats.$[seat].holdUntil': holdUntil,
        'seats.$[seat].bookingId': status === 'available' ? null : bookingId
      }
    },
    {
      arrayFilters: [
        {
          'seat.number': { $in: seats },
          'seat.bookingId': bookingId,
          'seat.status': status === 'available' ? 'held' : 'booked'
        }
      ]
    }
  );
}

export async function createBooking({ userId, showtimeId, seats, foodItems = [] }) {
  if (!Array.isArray(seats) || seats.length === 0) {
    throw bookingError('Select at least one seat', 400);
  }

  const requestedSeats = seats.map(String);
  if (new Set(requestedSeats).size !== requestedSeats.length) {
    throw bookingError('The same seat cannot be selected more than once', 400);
  }

  const showtime = await Showtime.findById(showtimeId);
  if (!showtime) throw bookingError('Showtime not found', 404);

  const now = new Date();
  await releaseExpiredSeats(showtimeId, now);

  const foods = await Food.find({ _id: { $in: foodItems.map((item) => item.food) } });
  let foodTotal = 0;
  const normalizedFoodItems = foodItems.map((item) => {
    const food = foods.find((candidate) => String(candidate._id) === String(item.food));
    if (!food) throw bookingError('Food item not found', 404);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw bookingError('Food quantity must be a positive integer', 400);
    }
    foodTotal += food.price * quantity;
    return { food: food._id, quantity };
  });

  const expiresAt = new Date(now.getTime() + SEAT_HOLD_MINUTES * 60 * 1000);
  const subtotal = showtime.price * requestedSeats.length + foodTotal;
  const booking = new Booking({
    user: userId,
    showtime: showtimeId,
    seats: requestedSeats,
    foodItems: normalizedFoodItems,
    subtotal,
    total: subtotal,
    expiresAt
  });

  const availabilityConditions = requestedSeats.map((number) => ({
    seats: { $elemMatch: { number, status: 'available' } }
  }));
  const claimResult = await Showtime.updateOne(
    { _id: showtimeId, $and: availabilityConditions },
    {
      $set: {
        'seats.$[seat].status': 'held',
        'seats.$[seat].holdUntil': expiresAt,
        'seats.$[seat].bookingId': booking._id
      }
    },
    {
      arrayFilters: [
        { 'seat.number': { $in: requestedSeats }, 'seat.status': 'available' }
      ]
    }
  );

  if (claimResult.modifiedCount !== 1) {
    throw bookingError('One or more selected seats are no longer available. Please choose different seats.', 409);
  }

  try {
    await booking.save();
    return await booking.populate([
      { path: 'showtime', populate: { path: 'movie' } },
      { path: 'foodItems.food' },
      { path: 'user' }
    ]);
  } catch (error) {
    await Booking.deleteOne({ _id: booking._id });
    await releaseBookingSeats(showtimeId, booking._id, requestedSeats);
    throw error;
  }
}

export async function applyMemberPoints(bookingId, userId, points) {
  if (!Number.isInteger(points) || points < 0) {
    throw bookingError('Points must be a non-negative integer', 400);
  }

  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw bookingError('Booking not found', 404);
  if (booking.status !== 'pending') throw bookingError('Booking cannot be changed', 400);
  if (!booking.expiresAt || booking.expiresAt <= new Date()) {
    throw bookingError('The seat hold has expired. Please create a new booking.', 410);
  }

  const user = await User.findById(userId);
  if (!user) throw bookingError('User not found', 404);
  if (user.memberPoints < points) {
    throw bookingError(`You only have ${user.memberPoints} member points available`, 400);
  }

  const maxRedeemablePoints = Math.floor(booking.subtotal / POINT_VALUE);
  if (points > maxRedeemablePoints) {
    throw bookingError(`You can apply at most ${maxRedeemablePoints} points to this booking`, 400);
  }

  const now = new Date();
  const updatedBooking = await Booking.findOneAndUpdate(
    { _id: bookingId, user: userId, status: 'pending', expiresAt: { $gt: now } },
    {
      $set: {
        pointsUsed: points,
        discount: points * POINT_VALUE,
        total: booking.subtotal - points * POINT_VALUE
      }
    },
    { new: true }
  );
  if (!updatedBooking) {
    throw bookingError('This booking changed or the seat hold expired. Refresh and try again.', 409);
  }
  return updatedBooking;
}

export async function pay(bookingId, userId, method = 'mock') {
  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw bookingError('Booking not found', 404);
  if (booking.status === 'paid') {
    return booking.populate([
      { path: 'showtime', populate: { path: 'movie' } },
      { path: 'foodItems.food' },
      { path: 'user', select: 'fullName email role memberPoints status' }
    ]);
  }
  if (booking.status !== 'pending') throw bookingError('This booking is no longer payable', 400);

  const now = new Date();
  if (!booking.expiresAt || booking.expiresAt <= now) {
    await releaseExpiredSeats(booking.showtime, now);
    await Booking.updateOne(
      { _id: booking._id, status: 'pending' },
      { $set: { status: 'cancelled', paymentStatus: 'failed' } }
    );
    throw bookingError('The 10-minute seat hold has expired. Please select your seats again.', 410);
  }

  const pointDeduction = booking.pointsUsed || 0;
  if (pointDeduction > 0) {
    const deduction = await User.updateOne(
      { _id: userId, memberPoints: { $gte: pointDeduction } },
      { $inc: { memberPoints: -pointDeduction } }
    );
    if (deduction.modifiedCount !== 1) {
      throw bookingError('Your available points have changed. Update or remove the points applied to this booking, then try again.', 409);
    }
  }

  const seatsBooked = await Showtime.updateOne(
    {
      _id: booking.showtime,
      $and: booking.seats.map((number) => ({
        seats: { $elemMatch: { number, status: 'held', bookingId: booking._id, holdUntil: { $gt: now } } }
      }))
    },
    {
      $set: {
        'seats.$[seat].status': 'booked',
        'seats.$[seat].holdUntil': null
      }
    },
    {
      arrayFilters: [
        {
          'seat.number': { $in: booking.seats },
          'seat.status': 'held',
          'seat.bookingId': booking._id,
          'seat.holdUntil': { $gt: now }
        }
      ]
    }
  );

  if (seatsBooked.modifiedCount !== 1) {
    if (pointDeduction > 0) {
      await User.updateOne({ _id: userId }, { $inc: { memberPoints: pointDeduction } });
    }
    throw bookingError('The seat hold expired or the seats are no longer reserved for this booking. Please book again.', 409);
  }

  const paidBooking = await Booking.findOneAndUpdate(
    { _id: booking._id, user: userId, status: 'pending', expiresAt: { $gt: now } },
    {
      $set: {
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: method,
        paymentRef: `PAY-${Date.now()}`
      }
    },
    { new: true }
  );

  if (!paidBooking) {
    await releaseBookingSeats(booking.showtime, booking._id, booking.seats, 'held', booking.expiresAt);
    if (pointDeduction > 0) {
      await User.updateOne({ _id: userId }, { $inc: { memberPoints: pointDeduction } });
    }
    throw bookingError('This booking changed while payment was processing. Please refresh and try again.', 409);
  }

  return paidBooking.populate([
    { path: 'showtime', populate: { path: 'movie' } },
    { path: 'foodItems.food' },
    { path: 'user', select: 'fullName email role memberPoints status' }
  ]);
}

export const listBookings = (userId) => Booking.find({ user: userId })
  .populate([{ path: 'showtime', populate: { path: 'movie' } }, { path: 'foodItems.food' }])
  .sort({ createdAt: -1 });
