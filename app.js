const express = require('express');
const cors = require('cors');

const app = express();

app.use(
  cors({
    origin: [
      'https://enquiry-system-mu.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    credentials: true,
    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-WhatsApp-Signature',
    ],
  })
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

// Load AUTH normally
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Load test route
const testRoutes = require('./routes/testRoutes');
app.use('/test', testRoutes);

// Add the other routes only after auth works
// const publicAgencyRoutes = require('./routes/publicAgencyRoutes');
// const agencyRoutes = require('./routes/agencyRoutes');
// const inboundMessageRoutes = require('./routes/inboundMessageRoutes');
// const whatsappRoutes = require('./routes/whatsappRoutes');

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error('Application error:', err);

  return res.status(500).json({
    success: false,
    message: err.message || 'Server error',
  });
});

module.exports = app;