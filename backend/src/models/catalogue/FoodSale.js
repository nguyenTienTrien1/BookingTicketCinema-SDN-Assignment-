import mongoose from 'mongoose';

const foodSaleSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestId: { type: String, required: true },
  items: [{
    _id: false,
    food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true }
  }],
  total: { type: Number, required: true },
  currency: { type: String, default: 'VND' },
  status: { type: String, enum: ['pending', 'payment_received', 'paid', 'cancelled', 'reconciliation', 'returned'], default: 'pending' },
  paymentMethod: { type: String, enum: ['cash'] },
  cashReceived: Number,
  change: Number,
  paymentConfirmedAt: Date,
  paidAt: Date,
  issue: String,
  returnedAmount: Number,
  returnedAt: Date,
  reconciliation: [{ _id: false, action: { type: String, enum: ['retry', 'cash-returned', 'note'] }, reason: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date }]
}, { timestamps: true });

// One request creates one order, including retries after a lost response.
foodSaleSchema.index({ employee: 1, requestId: 1 }, { unique: true });
export default mongoose.model('FoodSale', foodSaleSchema);
