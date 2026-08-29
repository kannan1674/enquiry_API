// const express = require('express');
// const cors = require('cors');
// const authRoutes = require('./routes/authRoutes');
// const agencyRoutes = require('./routes/agencyRoutes');
// const publicAgencyRoutes = require('./routes/publicAgencyRoutes');
// const testRoutes = require('./routes/testRoutes');

// const app = express();

// const allowedOrigins = [
//   'http://localhost:3000',
//   'http://127.0.0.1:3000',
//   'https://enquiry-system-mu.vercel.app',
//   process.env.FRONTEND_URL,
//   ...(process.env.CORS_ORIGINS || '').split(','),
// ]
//   .map((origin) => (typeof origin === 'string' ? origin.trim().replace(/\/$/, '') : ''))
//   .filter(Boolean);

// function isAllowedOrigin(origin) {
//   if (!origin) {
//     return true;
//   }
//   if (allowedOrigins.includes(origin)) {
//     return true;
//   }
//   return /^https:\/\/enquiry-system-mu(-[a-z0-9-]+)?\.vercel\.app$/.test(origin);
// }

// app.use(
//   cors({
//     origin(origin, callback) {
//       if (isAllowedOrigin(origin)) {
//         callback(null, true);
//         return;
//       }
//       callback(new Error(`CORS blocked: ${origin}`));
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
//   }),
// );
// app.use(express.json({ limit: '2mb' }));

// app.get('/health', (req, res) => {
//   res.json({ success: true, service: 'enquiry-system-api' });
// });

// app.use('/test', testRoutes);

// app.use('/api/auth', authRoutes);
// app.use('/api', publicAgencyRoutes);
// app.use('/api', agencyRoutes);
// app.use('/api/backend', publicAgencyRoutes);
// app.use('/api/backend', agencyRoutes);

// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: `Route not found: ${req.method} ${req.originalUrl}`,
//   });
// });

// app.use((err, req, res, next) => {
//   console.error(err);
//   res.status(err.status || 500).json({
//     success: false,
//     message: err.message || 'Server error',
//   });
// });

// module.exports = app;
const express = require('express');
const cors = require('cors');

const testRoutes = require('./routes/testRoutes');
const authRoutes = require('./routes/authRoutes');
const publicAgencyRoutes = require('./routes/publicAgencyRoutes');
const agencyRoutes = require('./routes/agencyRoutes');
const inboundMessageRoutes = require('./routes/inboundMessageRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');

const app = express();

app.use(
  cors({
    origin: ['https://enquiry-system-mu.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-WhatsApp-Signature'],
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Enquiry API is running',
  });
});

app.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    status: 'ok',
  });
});

// Test routes
app.use('/test', testRoutes);
app.use('/inbound-messages', inboundMessageRoutes);
app.use('/whatsapp', whatsappRoutes);

// Auth routes
app.use('/api/auth', authRoutes);

// Public agency routes
app.use('/api', publicAgencyRoutes);

// Protected/agency routes
app.use('/api', agencyRoutes);

// Optional backend aliases
app.use('/api/backend', publicAgencyRoutes);
app.use('/api/backend', agencyRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error('Application error:', err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error',
  });
});

module.exports = app;