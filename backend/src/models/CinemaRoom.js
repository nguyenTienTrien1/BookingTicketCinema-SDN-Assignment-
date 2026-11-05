import mongoose from 'mongoose';

const seatConfigSchema = new mongoose.Schema({
  type: { type: String, enum: ['Standard', 'VIP'], default: 'Standard' },
  status: { type: String, enum: ['Active', 'Broken', 'Maintenance', 'Disabled'], default: 'Active' }
}, { _id: false });

export function seatConfiguration(room, number) {
  let config;
  if (room.seatConfigs instanceof Map) config = room.seatConfigs.get(number);
  else if (room.seatConfigs) config = room.seatConfigs[number];
  return { type: config ? config.type : 'Standard', status: config ? config.status : 'Active' };
}

// Keep string seat identifiers for existing showtimes and room imports.
const schema = new mongoose.Schema({
  cinema: { type: String, required: true, trim: true, maxlength: 100 },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  status: { type: String, enum: ['Active', 'Inactive', 'Maintenance'], default: 'Inactive' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', select: false },
  seatConfigs: { type: Map, of: seatConfigSchema, default: {}, validate: {
    validator: function (configs) {
      if (!configs || configs.size === 0) return true;
      let seats = this.seats || this.get('seats');
      if (!seats && this.getUpdate) {
        const update = this.getUpdate();
        if (update.$setOnInsert) seats = update.$setOnInsert.seats;
      }
      if (!seats) return false;
      for (const number of configs.keys()) if (!seats.includes(number)) return false;
      return true;
    },
    message: 'Seat metadata must reference existing seats.'
  } },
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
