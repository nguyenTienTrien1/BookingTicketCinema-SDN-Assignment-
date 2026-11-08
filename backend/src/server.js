import 'dotenv/config';
import app from './app.js'; import { connectDatabase } from './config/db.js'; import { expireBookings } from './services/bookingService.js';
const port = process.env.PORT || 3000;
await connectDatabase();
const server = app.listen(port, () => console.log('API running at http://localhost:' + port));
let cleaning = false; const timer = setInterval(async () => { if (cleaning) return; cleaning = true; try { await expireBookings(); } catch (error) { console.error('Seat expiry cleanup:', error.message); } finally { cleaning = false; } }, 15000); timer.unref();
server.on('close', () => clearInterval(timer));
