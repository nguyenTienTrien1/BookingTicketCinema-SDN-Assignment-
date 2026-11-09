export function allowedClientOrigins() {
  return [process.env.CORS_ORIGIN || 'http://localhost:5173',
    ...(process.env.NODE_ENV !== 'production' ? [process.env.MOBILE_WEB_ORIGIN || 'http://localhost:8081'] : [])];
}

export function trustedClientRequest(req) {
  const origin = req.get('Origin');
  const preview = process.env.NODE_ENV !== 'production' && origin === (process.env.MOBILE_WEB_ORIGIN || 'http://localhost:8081') && req.headers.authorization?.startsWith('Bearer ');
  return (!origin || allowedClientOrigins().includes(origin)) && (req.get('Sec-Fetch-Site') !== 'cross-site' || preview);
}
