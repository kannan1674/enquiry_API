import express from 'express';
import * as inviteController from '../controller/inviteController.js';
import * as inboundController from '../controller/inboundController.js';

const router = express.Router();

router.get('/invites/:token', inviteController.getInvite);
router.post('/invites/:token/accept', inviteController.acceptInvite);

router.get('/webhooks/meta', inboundController.verifyMetaWebhook);
router.post('/webhooks/meta', inboundController.ingestInbound);
router.post('/webhooks/whatsapp', inboundController.ingestInbound);
router.post('/inbound/events', inboundController.ingestInbound);

export default router;
