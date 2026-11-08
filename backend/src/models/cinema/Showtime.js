import mongoose from 'mongoose';

const seatSchema = new mongoose.Schema({
  number: String,
  type: { type: String, enum: ['Standard', 'VIP'], default: 'Standard' },
  condition: { type: String, enum: ['Active', 'Broken', 'Maintenance', 'Disabled'], default: 'Active' },
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
  cancelledAt: Date, cancellationReason: String,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  seats: [seatSchema]
}, { timestamps: true });

export default mongoose.model('Showtime', showtimeSchema);
