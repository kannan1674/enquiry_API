import express from 'express';
import { authenticate, requireRoles } from '../middleware/auth.js';
import {
  setupApp,
  getStatus,
  getConnectUrl,
  completeLogin,
  syncConnection,
  callback,
} from '../controller/metaController.js';
import { verifyWebhook, receiveWebhook } from '../controller/metaWebhookController.js';

const router = express.Router();

const setupRoles = requireRoles('agency_super_admin', 'agency_manager', 'direct_owner');

router.get('/callback', callback);
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

router.post('/setup', authenticate, setupRoles, setupApp);
router.get('/status', authenticate, getStatus);
router.get('/connect-url', authenticate, getConnectUrl);
router.post('/complete', authenticate, completeLogin);
router.post('/sync', authenticate, syncConnection);

export default router;
