import { handleMetaVerify } from '../services/metaVerify.js';
import { saveWhatsappWebhookMessages } from '../services/whatsappInbound.js';

export function verifyWebhook(req, res) {
  const result = handleMetaVerify({
    mode: req.query['hub.mode'],
    token: req.query['hub.verify_token'],
    challenge: req.query['hub.challenge'],
  });

  if (result.ok) {
    res.status(200);
    res.set('Content-Type', 'text/plain');
    return res.send(result.challenge);
  }

  return res.status(403).json({
    success: false,
    message: 'Webhook verification failed',
  });
}

export async function receiveWebhook(req, res) {
  try {
    const body = req.body || {};

    await saveWhatsappWebhookMessages(body);

    return res.sendStatus(200);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return res.sendStatus(500);
  }
}
