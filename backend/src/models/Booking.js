import mongoose from 'mongoose';
const ticketSchema = new mongoose.Schema({
 seat: String, code: String, qr: String, reference: String,
 status: { type: String, default: 'valid' },
 issuedAt: Date, checkedInAt: Date,
 checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const bookingSchema = new mongoose.Schema({
 user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, required: function () { return !this.counterEmployee; } },
 counterEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
 showtime: { type: mongoose.Schema.Types.ObjectId, ref: 'Showtime', required: true },
 seats: [String], ticketPrice: Number,
 foodItems: [{ food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' }, name: String, unitPrice: Number, quantity: Number }],
 subtotal: { type: Number, required: true }, pointsUsed: { type: Number, default: 0 }, discount: { type: Number, default: 0 }, total: { type: Number, required: true },
 status: { type: String, enum: ['pending','paid','cancelled'], default: 'pending' },
 paymentStatus: { type: String, enum: ['unpaid','paid','failed'], default: 'unpaid' },
 paymentMethod: { type: String, enum: ['demo','cash','vnpay','points','mock','momo','credit-card'], default: 'cash' },
 paymentRef: String, activePayment: { type: String, default: null }, paymentProcessing: { type: Boolean, default: false }, expiresAt: Date,
 tickets: { type: [ticketSchema], default: [] }, paidAt: Date,
 ticketMode: { type: String, enum: ['verified','demo'] },
 ticketContext: { startTime: Date, cinema: String, room: String, movieTitle: String, classification: String, ageLimit: Number },
 ageCheckedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, guardianConfirmed: Boolean
}, { timestamps: true });
bookingSchema.index({ 'tickets.reference': 1 }, { unique: true, sparse: true });
bookingSchema.index({ 'tickets.code': 1 }, { sparse: true });
export default mongoose.model('Booking', bookingSchema);
