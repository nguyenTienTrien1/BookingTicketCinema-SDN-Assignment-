import mongoose from 'mongoose';
const foodSchema = new mongoose.Schema({
  name: { type: String, required: true }, description: String, image: String,
  price: { type: Number, required: true, min: 0 },
  available: { type: Boolean, default: true },
  stock: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  nameKey: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
foodSchema.index({ nameKey: 1 }, { unique: true, partialFilterExpression: { nameKey: { $type: 'string' }, deletedAt: null } });
export default mongoose.model('Food',foodSchema);
