// Sufficient for the current single Node process. A multi-instance deployment
// must move these counters to a shared store; never trust client X-Forwarded-For.
export function createPasswordResetLimiter(maxRequests, windowMs) {
  const clients = new Map();
  const cleanup = setInterval(function removeExpiredClients() {
    const now = Date.now();
    for (const [key, client] of clients) {
      if (client.expiresAt <= now) clients.delete(key);
    }
  }, 60 * 1000);
  cleanup.unref();

  return function passwordResetRateLimit(req, res, next) {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    const now = Date.now();
    const key = req.ip;
    let client = clients.get(key);
    if (!client || client.expiresAt <= now) {
      // Bound memory without evicting active limits when many addresses arrive.
      if (!client && clients.size >= 10000) {
        res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
        return res.status(429).json({ message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' });
      }
      client = { count: 0, expiresAt: now + windowMs };
      clients.set(key, client);
    }
    client.count += 1;
    if (client.count > maxRequests) {
      res.set('Retry-After', String(Math.ceil((client.expiresAt - now) / 1000)));
      return res.status(429).json({ message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' });
    }
    next();
  };
}
