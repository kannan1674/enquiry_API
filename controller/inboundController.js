const { routeInboundEvent, isChannelType } = require('../services/inboundRouter');

function firstDefined(...values) {
  return values.find((value) => value != null && value !== '');
}

function parseInboundBody(body = {}) {
  if (body.channelType && body.externalAssetId) {
    return {
      channelType: body.channelType,
      externalAssetId: String(body.externalAssetId),
      externalEventId: body.externalEventId || body.eventId || null,
      contactName: body.contactName || body.name || null,
      contactEmail: body.contactEmail || body.email || null,
      contactPhone: body.contactPhone || body.phone || null,
      message: body.message || null,
      payload: body,
    };
  }

  const change = body.entry?.[0]?.changes?.[0]?.value || {};
  const formId = change.form_id;
  if (formId) {
    return {
      channelType: 'lead_form',
      externalAssetId: String(formId),
      externalEventId: firstDefined(change.leadgen_id, body.entry?.[0]?.id),
      payload: body,
    };
  }

  const whatsappId = change.metadata?.phone_number_id;
  if (whatsappId) {
    const message = change.messages?.[0];
    return {
      channelType: 'whatsapp',
      externalAssetId: String(whatsappId),
      externalEventId: message?.id || body.entry?.[0]?.id || null,
      contactName: change.contacts?.[0]?.profile?.name || null,
      contactPhone: message?.from || null,
      message: message?.text?.body || null,
      payload: body,
    };
  }

  const objectType = body.object;
  const pageOrIgId = body.entry?.[0]?.id;
  if (pageOrIgId && objectType === 'instagram') {
    return {
      channelType: 'instagram',
      externalAssetId: String(pageOrIgId),
      externalEventId: body.entry?.[0]?.id || null,
      payload: body,
    };
  }
  if (pageOrIgId) {
    return {
      channelType: 'facebook_page',
      externalAssetId: String(pageOrIgId),
      externalEventId: firstDefined(change.leadgen_id, body.entry?.[0]?.id),
      payload: body,
    };
  }

  return null;
}

async function ingestInbound(req, res, next) {
  try {
    const event = parseInboundBody(req.body);
    if (!event || !isChannelType(event.channelType) || !event.externalAssetId) {
      return res.status(400).json({
        success: false,
        message: 'Inbound event is missing a channel type or mapped asset ID',
      });
    }

    const result = await routeInboundEvent(event);
    return res.status(result.routed ? 202 : 200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

function verifyMetaWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.META_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && token === expected) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ success: false, message: 'Webhook verification failed' });
}

module.exports = {
  ingestInbound,
  verifyMetaWebhook,
};
