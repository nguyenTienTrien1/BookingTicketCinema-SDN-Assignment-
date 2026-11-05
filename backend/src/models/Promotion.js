import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true, min: 1 },
  minOrder: { type: Number, default: 0, min: 0 },
  maxDiscount: { type: Number, default: null, min: 1 },
  scope: { type: String, enum: ['food', 'ticket', 'all'], required: true },
  stackable: { type: Boolean, required: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  usageLimit: { type: Number, default: null, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Promotion', promotionSchema);
