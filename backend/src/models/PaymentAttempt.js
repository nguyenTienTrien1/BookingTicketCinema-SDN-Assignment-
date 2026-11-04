import mongoose from 'mongoose';
const schema = new mongoose.Schema({
 ref: { type: String, required: true, unique: true }, booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
 amount: { type: Number, required: true }, currency: { type: String, default: 'VND' }, method: { type: String, enum: ['demo','cash','vnpay','points'], required: true },
 status: { type: String, enum: ['created','succeeded','failed','unresolved'], default: 'created' }, expiresAt: Date,
 providerRef: String, responseCode: String, message: String, receivedAmount: Number,
 actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
schema.index({ providerRef: 1, method: 1 }, { unique: true, partialFilterExpression: { providerRef: { $type: 'string' } } });
export default mongoose.model('PaymentAttempt', schema);
