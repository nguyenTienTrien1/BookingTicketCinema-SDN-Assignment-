import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import CinemaRoom from './src/models/CinemaRoom.js';

// Explicit setup only. Never change existing rooms, layouts or showtimes.
async function importRooms() {
  try {
    const filename = process.argv[2];
    if (!filename) throw new Error('Usage: npm run import:rooms -w backend -- <rooms.json>');
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing in backend/.env.');
    const input = JSON.parse(await readFile(filename, 'utf8'));
    if (!Array.isArray(input) || input.length === 0 || input.length > 1000) {
      throw new Error('Supply an array containing 1–1000 rooms.');
    }
    const rooms = [];
    const seen = new Set();
    for (const item of input) {
      const room = new CinemaRoom({ cinema: item.cinema, name: item.name, status: item.status, seats: item.seats });
      await room.validate();
      const key = JSON.stringify([room.cinema.toLowerCase(), room.name.toLowerCase()]);
      if (seen.has(key)) throw new Error('Duplicate cinema and room name in the input file.');
      seen.add(key);
      rooms.push(room);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    await CinemaRoom.init();
    let inserted = 0;
    for (const room of rooms) {
      const result = await CinemaRoom.updateOne(
        { cinema: room.cinema, name: room.name },
        { $setOnInsert: { cinema: room.cinema, name: room.name, status: room.status, seats: room.seats } },
        { upsert: true, runValidators: true, collation: { locale: 'en', strength: 2 } }
      );
      inserted += result.upsertedCount;
    }
    console.log(`Inserted ${inserted} rooms; preserved ${rooms.length - inserted} existing rooms.`);
  } catch (error) {
    console.error('Room import failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

await importRooms();
