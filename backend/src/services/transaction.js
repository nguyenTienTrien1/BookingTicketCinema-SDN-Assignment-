import mongoose from 'mongoose';
export function domainError(message, status = 400) { return Object.assign(new Error(message), { status }); }
export async function transaction(work) {
 const session = await mongoose.startSession();
 try { let result; await session.withTransaction(async () => { result = await work(session); }); return result; }
 catch (error) { if (error.code === 20) throw domainError('MongoDB replica set is required. Run the local database setup.', 503); throw error; }
 finally { await session.endSession(); }
}
