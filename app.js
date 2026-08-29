import express from 'express';
import cors from 'cors';
import { isAllowedOrigin } from './config/cors.js';
import authRoutes from './routes/authRoutes.js';
import metaRoutes from './routes/metaRoutes.js';
import publicAgencyRoutes from './routes/publicAgencyRoutes.js';
import agencyRoutes from './routes/agencyRoutes.js';
import inboundMessageRoutes from './routes/inboundMessageRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    maxAge: 86400,
    optionsSuccessStatus: 204,
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

app.use('/api/auth', authRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/inbound-messages', inboundMessageRoutes);
app.use('/inbound-messages', inboundMessageRoutes);
app.use('/api', publicAgencyRoutes);
app.use('/api', agencyRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error('APPLICATION ERROR:', err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error',
  });
});

export default app;
