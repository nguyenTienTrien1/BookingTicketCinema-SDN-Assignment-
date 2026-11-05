import mongoose from 'mongoose';

// A short-lived, server-owned snapshot guarantees export uses the displayed data.
const revenueReportSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  result: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  expiresAt: { type: Date, required: true, immutable: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

revenueReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('RevenueReport', revenueReportSchema);
