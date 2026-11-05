import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import movieRoutes from './routes/movieRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import foodRoutes from './routes/foodRoutes.js';
import foodSaleRoutes from './routes/foodSaleRoutes.js';

import showtimeRoutes from './routes/showtimeRoutes.js';

import { verifyToken } from './middleware/auth/verifyToken.js';
import { requireRole } from './middleware/auth/requireRole.js';
import { memberDashboard, employeeDashboard } from './controllers/auth/loginController.js';
import { adminDashboard } from './controllers/auth/adminLoginController.js';

const app = express();

// 1. CORS Configuration with credentials enabled for HttpOnly cookies
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));

// 2. Body parser & Cookie parser middlewares
app.use(express.json());
app.use(cookieParser());

// 3. Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 4. Authentication routes
app.use('/api/auth', authRoutes);

// 5. Protected Dashboard Endpoints (Section 15 Requirements)
app.get('/api/member/dashboard', verifyToken, requireRole('member'), memberDashboard);
app.get('/api/employee/dashboard', verifyToken, requireRole('employee'), employeeDashboard);
app.get('/api/admin/dashboard', verifyToken, requireRole('admin'), adminDashboard);

// 6. Existing Cinema Business Domain Routes (Preserved intact)
app.use('/api/users', userRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/food-sales', foodSaleRoutes);

app.use('/api/showtimes', showtimeRoutes);

// 7. Global Centralized Error Handling Middleware
app.use((err, _req, res, _next) => {
  const status = err.name === 'ValidationError' || err.name === 'CastError' ? 400 : err.code === 11000 ? 409 : err.status || 500;
  if (status >= 500) console.error('[SERVER ERROR]', err);
  let message = err.name === 'CastError' ? 'Invalid ID or field value.' : err.message || 'Đã xảy ra lỗi máy chủ.';

  if (err.name === 'ValidationError') {
    message = 'Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra lại.';
  } else if (err.code === 11000) {
    message = 'Email này đã được sử dụng.';
  } else if (status >= 500) {
    message = 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.';
  }

  res.status(status).json({ message });
});

export default app;
