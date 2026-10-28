import mongoose from 'mongoose';

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  poster: String,
  banner: String, // Backdrop image URL
  trailer: { type: String, default: '' }, // YouTube Embed URL or Video ID
  genre: [String],
  duration: { type: Number, default: 120 },
  ageLimit: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  releaseDate: Date,
  status: { type: String, enum: ['now-showing', 'coming-soon'], default: 'now-showing' },
  featured: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Movie', movieSchema);
