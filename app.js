const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const agencyRoutes = require('./routes/agencyRoutes');
const publicAgencyRoutes = require('./routes/publicAgencyRoutes');
const testRoutes = require('./routes/testRoutes');
const inboundMessageRoutes = require('./routes/inboundMessageRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');

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

// --------------------
// Load routes safely
// --------------------

try {
  const testRoutes = require('./routes/testRoutes');
  app.use('/test', testRoutes);
  console.log('testRoutes loaded');
} catch (error) {
  console.error('FAILED testRoutes:', error);
}

try {
  const authRoutes = require('./routes/authRoutes');
  app.use('/api/auth', authRoutes);
  console.log('authRoutes loaded');
} catch (error) {
  console.error('FAILED authRoutes:', error);
}

try {
  const publicAgencyRoutes = require('./routes/publicAgencyRoutes');
  app.use('/api', publicAgencyRoutes);
  app.use('/api/backend', publicAgencyRoutes);
  console.log('publicAgencyRoutes loaded');
} catch (error) {
  console.error('FAILED publicAgencyRoutes:', error);
}

try {
  const agencyRoutes = require('./routes/agencyRoutes');
  app.use('/api', agencyRoutes);
  app.use('/api/backend', agencyRoutes);
  console.log('agencyRoutes loaded');
} catch (error) {
  console.error('FAILED agencyRoutes:', error);
}

try {
  const inboundMessageRoutes = require('./routes/inboundMessageRoutes');
  app.use('/inbound-messages', inboundMessageRoutes);
  console.log('inboundMessageRoutes loaded');
} catch (error) {
  console.error('FAILED inboundMessageRoutes:', error);
}

try {
  const whatsappRoutes = require('./routes/whatsappRoutes');
  app.use('/whatsapp', whatsappRoutes);
  console.log('whatsappRoutes loaded');
} catch (error) {
  console.error('FAILED whatsappRoutes:', error);
}

// 404
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Application error:', err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error',
  });
});

module.exports = app;