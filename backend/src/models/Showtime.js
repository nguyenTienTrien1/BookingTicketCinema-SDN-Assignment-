import mongoose from 'mongoose';

const seatSchema = new mongoose.Schema({
  number: String,
  status: { type: String, enum: ['available', 'held', 'booked'], default: 'available' },
  holdUntil: Date,
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }
});

const showtimeSchema = new mongoose.Schema({
  movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'CinemaRoom' },
  cinema: { type: String, required: true },
  room: { type: String, required: true },
  startTime: { type: Date, required: true },
  price: { type: Number, required: true },
  seats: [seatSchema]
}, { timestamps: true });

export default mongoose.model('Showtime', showtimeSchema);
