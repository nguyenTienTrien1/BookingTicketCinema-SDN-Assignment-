import mongoose from 'mongoose';

// Append-only ticket payment/refund evidence. Only trusted settlement code may
// write here; there is deliberately no client-facing create/update endpoint.
const revenueEntrySchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, immutable: true },
  reference: { type: String, required: true, unique: true, trim: true, immutable: true },
  kind: { type: String, enum: ['payment', 'refund'], required: true, immutable: true },
  originalReference: { type: String, immutable: true },
  method: { type: String, enum: ['cash', 'vnpay', 'momo', 'credit-card', 'points'], required: true, immutable: true },
  evidence: { type: String, enum: ['employee-receipt', 'provider-confirmation', 'points-ledger'], required: true, immutable: true },
  confirmedAt: { type: Date, required: true, immutable: true },
  currency: { type: String, enum: ['VND'], default: 'VND', immutable: true },
  gross: { type: Number, default: 0, min: 0, immutable: true },
  discounts: { type: Number, default: 0, min: 0, immutable: true },
  fees: { type: Number, default: 0, min: 0, immutable: true },
  points: { type: Number, default: 0, min: 0, immutable: true },
  amount: { type: Number, required: true, min: 0, immutable: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

revenueEntrySchema.index({ confirmedAt: 1, createdAt: 1 });
// BR-13/14: one final settlement and one full refund per booking.
revenueEntrySchema.index({ booking: 1, kind: 1 }, { unique: true });
export default mongoose.model('RevenueEntry', revenueEntrySchema);
