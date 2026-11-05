import mongoose from 'mongoose';

// Shared room catalogue for scheduling. UC-14 can manage this model later.
const schema = new mongoose.Schema({
  cinema: { type: String, required: true, trim: true, maxlength: 100 },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  status: { type: String, enum: ['Active', 'Inactive', 'Maintenance'], default: 'Inactive' },
  seats: { type: [String], default: [], validate: {
    validator: function (seats) {
      if (seats.length === 0 || seats.length > 1000) return false;
      const seen = new Set();
      for (const number of seats) {
        // Row letters followed by a positive seat number, for example A1 or AA12.
        if (typeof number !== 'string' || !/^[A-Z]+[1-9][0-9]*$/.test(number) || seen.has(number)) {
          return false;
        }
        seen.add(number);
      }
      return true;
    },
    message: 'Room needs a non-empty layout with unique seat numbers (for example A1).'
  } }
}, { timestamps: true });
schema.index({ cinema: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
export default mongoose.model('CinemaRoom', schema);
