import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/db.js';

const port = Number(process.env.PORT) || 5000;

try {
  await connectDatabase();
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
} catch (error) {
  console.error('Failed to start server:', error.message);
  process.exit(1);
}
