import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import Food from '../models/Food.js';
import User from '../models/User.js';
import Movie from '../models/Movie.js';

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
  if (!mongoose.isObjectIdOrHexString(userId) || !mongoose.isObjectIdOrHexString(showtimeId) || !Array.isArray(foodItems) || foodItems.some((item) => !item || !mongoose.isObjectIdOrHexString(item.food))) {
    throw bookingError('Invalid booking data.', 400);
  }
  if (!Array.isArray(seats) || seats.length === 0) {
    throw bookingError('Vui lòng chọn ít nhất một ghế.', 400);
  }

  const requestedSeats = seats.map(String);
  if (new Set(requestedSeats).size !== requestedSeats.length) {
    throw bookingError('Không thể chọn một ghế nhiều lần.', 400);
  }

  const showtime = await Showtime.findById(showtimeId);
  if (!showtime) throw bookingError('Không tìm thấy suất chiếu.', 404);

  const movie = await Movie.findById(showtime.movie);
  if (!movie || movie.deletedAt || movie.classification === 'C') {
    throw bookingError('Phim không được phép bán vé.', 400);
  }

  const now = new Date();
  await releaseExpiredSeats(showtimeId, now);

  const foods = await Food.find({ _id: { $in: foodItems.map((item) => item.food) } });
  let foodTotal = 0;
  const normalizedFoodItems = foodItems.map((item) => {
    const food = foods.find((candidate) => String(candidate._id) === String(item.food));
    if (!food) throw bookingError('Không tìm thấy món ăn hoặc thức uống.', 404);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw bookingError('Số lượng món ăn phải là số nguyên dương.', 400);
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
    // Reject a stale price/schedule snapshot if Admin edits before seats are claimed.
    { _id: showtimeId, movie: showtime.movie, cinema: showtime.cinema, room: showtime.room,
      startTime: showtime.startTime, price: showtime.price, $and: availabilityConditions },
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
    throw bookingError('Một hoặc nhiều ghế đã chọn không còn trống. Vui lòng chọn ghế khác.', 409);
  }

  try {
    await booking.save();
    return await booking.populate([
      { path: 'showtime', populate: { path: 'movie' } },
      { path: 'foodItems.food' },
      { path: 'user', select: 'fullName email role memberPoints status' }
    ]);
  } catch (error) {
    await Booking.deleteOne({ _id: booking._id });
    await releaseBookingSeats(showtimeId, booking._id, requestedSeats);
    throw error;
  }
}

export async function applyMemberPoints(bookingId, userId, points) {
  if (!Number.isInteger(points) || points < 0) {
    throw bookingError('Điểm sử dụng phải là số nguyên không âm.', 400);
  }

  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw bookingError('Không tìm thấy đơn đặt vé.', 404);
  if (booking.status !== 'pending') throw bookingError('Không thể thay đổi đơn đặt vé này.', 400);
  if (!booking.expiresAt || booking.expiresAt <= new Date()) {
    throw bookingError('Thời gian giữ ghế đã hết. Vui lòng tạo đơn đặt vé mới.', 410);
  }

  const user = await User.findById(userId);
  if (!user) throw bookingError('Không tìm thấy tài khoản.', 404);
  if (user.memberPoints < points) {
    throw bookingError(`Bạn chỉ còn ${user.memberPoints} điểm thành viên.`, 400);
  }

  const maxRedeemablePoints = Math.floor(booking.subtotal / POINT_VALUE);
  if (points > maxRedeemablePoints) {
    throw bookingError(`Đơn này chỉ có thể sử dụng tối đa ${maxRedeemablePoints} điểm.`, 400);
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
    throw bookingError('Đơn đặt vé đã thay đổi hoặc thời gian giữ ghế đã hết. Vui lòng tải lại và thử lại.', 409);
  }
  return updatedBooking;
}

export async function pay(bookingId, userId, method = 'mock') {
  if (!['cash', 'vnpay', 'momo', 'credit-card', 'mock'].includes(method)) {
    throw bookingError('Invalid payment method.', 400);
  }
  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw bookingError('Không tìm thấy đơn đặt vé.', 404);
  if (booking.status === 'paid') {
    return booking.populate([
      { path: 'showtime', populate: { path: 'movie' } },
      { path: 'foodItems.food' },
      { path: 'user', select: 'fullName email role memberPoints status' }
    ]);
  }
  if (booking.status !== 'pending') throw bookingError('Đơn đặt vé này không còn ở trạng thái có thể thanh toán.', 400);

  const now = new Date();
  if (!booking.expiresAt || booking.expiresAt <= now) {
    await releaseExpiredSeats(booking.showtime, now);
    await Booking.updateOne(
      { _id: booking._id, status: 'pending' },
      { $set: { status: 'cancelled', paymentStatus: 'failed' } }
    );
    throw bookingError('Thời gian giữ ghế 10 phút đã hết. Vui lòng chọn lại ghế.', 410);
  }

  const pointDeduction = booking.pointsUsed || 0;
  if (pointDeduction > 0) {
    const deduction = await User.updateOne(
      { _id: userId, memberPoints: { $gte: pointDeduction } },
      { $inc: { memberPoints: -pointDeduction } }
    );
    if (deduction.modifiedCount !== 1) {
      throw bookingError('Số điểm hiện có đã thay đổi. Vui lòng cập nhật hoặc bỏ số điểm đã áp dụng rồi thử lại.', 409);
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
    throw bookingError('Thời gian giữ ghế đã hết hoặc ghế không còn được giữ cho đơn này. Vui lòng đặt vé lại.', 409);
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
    throw bookingError('Đơn đặt vé đã thay đổi trong lúc xử lý thanh toán. Vui lòng tải lại và thử lại.', 409);
  }

  return paidBooking.populate([
    { path: 'showtime', populate: { path: 'movie' } },
    { path: 'foodItems.food' },
    { path: 'user', select: 'fullName email role memberPoints status' }
  ]);
}

export const listBookings = (userId) => Booking.find({ user: userId })
  .select('showtime seats foodItems subtotal pointsUsed discount total status paymentMethod paymentStatus paymentRef expiresAt createdAt updatedAt')
  .populate([
    { path: 'showtime', select: 'movie cinema room startTime', populate: { path: 'movie', select: 'title' } },
    { path: 'foodItems.food', select: 'name' }
  ])
  .sort({ createdAt: -1, _id: -1 });
