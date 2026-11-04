import 'dotenv/config';
import mongoose from 'mongoose';
import Food from './src/models/Food.js';

// Optional local demo setup. Existing products and stock are never overwritten.
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema';
const parsed = new URL(uri);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.pathname !== '/booking_cinema') {
  throw new Error('Demo seed only supports the local booking_cinema database.');
}
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const items = [
    { name: 'Popcorn Small', description: 'Bắp rang nhỏ', price: 35000, stock: 30 },
    { name: 'Coca Cola', description: 'Nước ngọt', price: 25000, stock: 30 },
    { name: 'Dasani', description: 'Nước suối', price: 15000, stock: 30 }
  ];
  for (const item of items) {
    const result = await Food.updateOne({ name: item.name }, { $setOnInsert: { ...item, available: true } }, { upsert: true });
    console.log(`${item.name}: ${result.upsertedCount ? 'created with 30 demo units' : 'already exists; unchanged'}`);
  }
} finally {
  await mongoose.disconnect();
}
