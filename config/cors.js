const STATIC_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'https://enquiry-system-mu.vercel.app',
  'https://enquiry-system-mu-git-main-enquiry-system-mu.vercel.app',
  'https://enquiry-system-mu-git-main-enquiry-system-mu.vercel.app',
];

function configuredOrigins() {
  return [
    ...STATIC_ORIGINS,
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS || '').split(','),
  ]
    .map((origin) => (typeof origin === 'string' ? origin.trim().replace(/\/$/, '') : ''))
    .filter(Boolean);
}

export function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  const normalized = String(origin).replace(/\/$/, '');
  if (configuredOrigins().includes(normalized)) {
    return true;
  }

  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalized)) {
    return true;
  }

  return /^https:\/\/enquiry-system(-mu)?([.-][a-z0-9-]+)*\.vercel\.app$/.test(normalized);
}

export function applyCorsHeaders(req, res) {
  const origin = req.headers?.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept',
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}
