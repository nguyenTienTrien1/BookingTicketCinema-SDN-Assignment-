import * as revenue from '../services/revenueService.js';

export function protectReportRequest(req, res, next) {
  const origin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  if (req.get('Sec-Fetch-Site') === 'cross-site' || (req.get('Origin') && req.get('Origin') !== origin)) {
    return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
  }
  if (!req.is('application/json')) return res.status(415).json({ message: 'Yêu cầu phải dùng application/json.' });
  res.set('Cache-Control', 'no-store');
  next();
}

export async function dashboard(req, res, next) {
  try {
    const result = await revenue.createReport(req.body, req.user._id);
    console.log(`[REVENUE AUDIT] admin=${req.user._id} action=dashboard report=${result.reportId}`);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
