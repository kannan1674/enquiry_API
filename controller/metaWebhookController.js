import { saveWhatsappWebhookMessages } from '../services/whatsappInbound.js';

export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && token === expected) {
    return res.status(200).send(challenge);
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
