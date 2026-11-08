import mongoose from 'mongoose';
import User from "../models/users/User.js";

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Set it in backend/.env.');
  }

  await mongoose.connect(uri);
  // Do not accept authentication requests before uniqueness is enforced.
  await User.init();
  console.log('MongoDB connected');
}
