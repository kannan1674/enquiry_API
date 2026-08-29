const express = require('express');
const cors = require('cors');

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
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

// AUTH
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error('APPLICATION ERROR:', err);

  return res.status(500).json({
    success: false,
    message: err.message || 'Server error',
  });
});

module.exports = app;