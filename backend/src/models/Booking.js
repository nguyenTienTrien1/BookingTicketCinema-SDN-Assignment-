import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  reference: { type: String, required: true },
  seat: { type: String, required: true },
  status: { type: String, enum: ['issued', 'checked-in', 'revoked'], default: 'issued' },
  issuedAt: { type: Date, required: true },
  checkedInAt: Date,
  checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  showtime: { type: mongoose.Schema.Types.ObjectId, ref: 'Showtime', required: true },
  seats: [String],
  foodItems: [{ food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' }, quantity: { type: Number, min: 1 } }],
  subtotal: { type: Number, required: true },
  pointsUsed: { type: Number, default: 0 }, discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  paymentMethod: { type: String, enum: ['cash', 'vnpay', 'momo', 'credit-card', 'mock'], default: 'mock' },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'failed'], default: 'unpaid' },
  paymentRef: String, expiresAt: Date,
  tickets: { type: [ticketSchema], default: [] },
  ticketMode: { type: String, enum: ['verified', 'demo'] },
  ticketContext: {
    startTime: Date, cinema: String, room: String, movieTitle: String,
    classification: String, ageLimit: Number
  }
}, { timestamps: true });

bookingSchema.index({ 'tickets.reference': 1 }, { unique: true, sparse: true });
export default mongoose.model('Booking', bookingSchema);
