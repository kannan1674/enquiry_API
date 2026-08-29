import { InboundMessage, TenantChannelAsset } from '../models/index.js';
import { connectDatabase } from '../config/db.config.js';

const VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN || 'enquiry_system_whatsapp_verify_2026';

const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('WhatsApp webhook verification request received');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified successfully');
    return res.status(200).send(challenge);
  }

  console.log('WhatsApp webhook verification failed');
  return res.sendStatus(403);
};

const receiveWebhook = async (req, res) => {
  try {
    const body = req.body;

    console.log('WhatsApp webhook received:', JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    const phoneNumberId = value?.metadata?.phone_number_id;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    await connectDatabase();

    const customerNumber = message.from || '';
    const customerName = contact?.profile?.name || '';
    const text =
      message.text?.body ||
      message.button?.text ||
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      '';

    const receivedAt = message.timestamp
      ? new Date(Number(message.timestamp) * 1000)
      : new Date();

    console.log('Phone Number ID:', phoneNumberId);
    console.log('Customer:', customerNumber);
    console.log('Customer Name:', customerName);
    console.log('Message:', text);

    const mappedAsset = await TenantChannelAsset.findOne({
      where: {
        externalId: phoneNumberId,
        channelType: 'whatsapp',
      },
    });

    const savedMessage = await InboundMessage.create({
      clientId: mappedAsset?.tenantId || null,
      source: 'whatsapp',
      externalId: phoneNumberId || message.id,
      customerName,
      customerNumber,
      message: text,
      whatsappMessageId: message.id,
      status: 'new',
      rawPayload: body,
      receivedAt,
    });

    console.log('WhatsApp message saved:', savedMessage.id);

    return res.sendStatus(200);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return res.sendStatus(200);
  }
};

export { verifyWebhook, receiveWebhook };
