import mongoose from 'mongoose';

// A payment reference can fund one point credit only, across all refund flows.
const schema = new mongoose.Schema({
 reference: { type: String, required: true, unique: true },
 booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
 user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
 kind: { type: String, enum: ['member', 'cinema', 'payment-failure'], required: true },
 method: { type: String, enum: ['cash', 'vnpay', 'points'], required: true },
 rate: Number, base: Number, amount: Number, points: Number,
 status: { type: String, enum: ['pending', 'unresolved', 'completed'], default: 'pending' },
 policy: { type: String, default: 'member-points-v1' },
 reason: String, error: String,
 actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
 retries: [{ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date }],
 balanceBefore: Number, balanceAfter: Number, completedAt: Date
}, { timestamps: true });
schema.index({ booking: 1, createdAt: -1 });
export default mongoose.model('PointRefund', schema);
