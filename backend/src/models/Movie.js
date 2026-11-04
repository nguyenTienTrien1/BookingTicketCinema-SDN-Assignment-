import mongoose from 'mongoose';
const movieSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: String,
  poster: String,
  banner: String,
  genre: [String],
  duration: { type: Number, default: 120, min: 1 },
  ageLimit: { type: Number, default: 0 },
  classification: { type: String, enum: ['P', 'K', 'T13', 'T16', 'T18', 'C'] },
  rating: { type: Number, default: 0, min: 0, max: 10 },
  releaseDate: Date,
  featured: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export default mongoose.model('Movie',movieSchema);
