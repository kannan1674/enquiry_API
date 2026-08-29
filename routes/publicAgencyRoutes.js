const express = require('express');
const inviteController = require('../controller/inviteController');
const inboundController = require('../controller/inboundController');
const metaController = require('../controller/metaController');

const router = express.Router();

router.get('/invites/:token', inviteController.getInvite);
router.post('/invites/:token/accept', inviteController.acceptInvite);

router.get('/webhooks/meta', inboundController.verifyMetaWebhook);
router.post('/webhooks/meta', inboundController.ingestInbound);
router.post('/webhooks/whatsapp', inboundController.ingestInbound);
router.post('/inbound/events', inboundController.ingestInbound);
router.get('/meta/callback', metaController.callback);

module.exports = router;
