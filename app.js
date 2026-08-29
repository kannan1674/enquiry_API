const express = require('express');
const cors = require('cors');

const app = express();

// --------------------------------------------------
// CORS
// --------------------------------------------------

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

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json({ limit: '2mb' }));

app.use(
  express.urlencoded({
    extended: true,
  })
);

// --------------------------------------------------
// Basic routes
// --------------------------------------------------

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

// --------------------------------------------------
// TEST ROUTES
// --------------------------------------------------

try {
  const testRoutes = require('./routes/testRoutes');

  app.use('/test', testRoutes);

  console.log('testRoutes loaded successfully');
} catch (error) {
  console.error(
    'FAILED TO LOAD testRoutes:',
    error.message,
    error.stack
  );
}

// --------------------------------------------------
// AUTH ROUTES
// --------------------------------------------------

try {
  const authRoutes = require('./routes/authRoutes');

  app.use('/api/auth', authRoutes);

  console.log('authRoutes loaded successfully');
} catch (error) {
  console.error(
    'FAILED TO LOAD authRoutes:',
    error.message,
    error.stack
  );
}

// --------------------------------------------------
// PUBLIC AGENCY ROUTES
// --------------------------------------------------

try {
  const publicAgencyRoutes = require(
    './routes/publicAgencyRoutes'
  );

  app.use('/api', publicAgencyRoutes);
  app.use('/api/backend', publicAgencyRoutes);

  console.log(
    'publicAgencyRoutes loaded successfully'
  );
} catch (error) {
  console.error(
    'FAILED TO LOAD publicAgencyRoutes:',
    error.message,
    error.stack
  );
}

// --------------------------------------------------
// AGENCY ROUTES
// --------------------------------------------------

try {
  const agencyRoutes = require(
    './routes/agencyRoutes'
  );

  app.use('/api', agencyRoutes);
  app.use('/api/backend', agencyRoutes);

  console.log('agencyRoutes loaded successfully');
} catch (error) {
  console.error(
    'FAILED TO LOAD agencyRoutes:',
    error.message,
    error.stack
  );
}

// --------------------------------------------------
// INBOUND MESSAGE ROUTES
// --------------------------------------------------

try {
  const inboundMessageRoutes = require(
    './routes/inboundMessageRoutes'
  );

  app.use(
    '/inbound-messages',
    inboundMessageRoutes
  );

  console.log(
    'inboundMessageRoutes loaded successfully'
  );
} catch (error) {
  console.error(
    'FAILED TO LOAD inboundMessageRoutes:',
    error.message,
    error.stack
  );
}

// --------------------------------------------------
// WHATSAPP ROUTES
// --------------------------------------------------

try {
  const whatsappRoutes = require(
    './routes/whatsappRoutes'
  );

  app.use('/whatsapp', whatsappRoutes);

  console.log(
    'whatsappRoutes loaded successfully'
  );
} catch (error) {
  console.error(
    'FAILED TO LOAD whatsappRoutes:',
    error.message,
    error.stack
  );
}

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// --------------------------------------------------
// Error handler
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error(
    'Application error:',
    err.message,
    err.stack
  );

  return res
    .status(err.status || 500)
    .json({
      success: false,
      message:
        err.message || 'Server error',
    });
});

module.exports = app;