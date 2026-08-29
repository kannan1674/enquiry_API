const { routeInboundEvent } = require('./inboundRouter');

const SOURCE_TO_CHANNEL = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  facebook: 'facebook_page',
  facebook_page: 'facebook_page',
  page: 'facebook_page',
  lead_form: 'lead_form',
  leadform: 'lead_form',
  'lead-form': 'lead_form',
};

function inboundMessagesUrl() {
  return (process.env.INBOUND_MESSAGES_URL || 'https://ariome.duckdns.org/api/inbound-messages').replace(
    /\/$/,
    '',
  );
}

function channelFromSource(source) {
  return SOURCE_TO_CHANNEL[String(source || '').toLowerCase()] || null;
}

function toInboundEvent(message = {}) {
  const channelType = channelFromSource(message.source);
  const externalAssetId = message.externalId || message.phoneNumberId || null;
  const rawPayload = message.rawPayload && typeof message.rawPayload === 'object' ? message.rawPayload : message;

  return {
    channelType,
    externalAssetId: externalAssetId ? String(externalAssetId) : null,
    externalEventId: message.whatsappMessageId || message.externalEventId || message._id || null,
    contactName: message.customerName || null,
    contactPhone: message.customerNumber || null,
    message: message.message || null,
    payload: {
      ...rawPayload,
      inboundId: message._id || null,
      contactName: message.customerName || null,
      contactPhone: message.customerNumber || null,
      message: message.message || null,
    },
  };
}

async function fetchInboundMessages() {
  const response = await fetch(inboundMessagesUrl(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Inbound messages request failed (${response.status})`);
  }

  const data = await response.json();
  if (!data || data.success === false) {
    throw new Error(data?.message || 'Inbound messages request failed');
  }

  return Array.isArray(data.messages) ? data.messages : [];
}

async function syncInboundMessages() {
  const messages = await fetchInboundMessages();
  const summary = {
    pulled: messages.length,
    routed: 0,
    quarantined: 0,
    duplicates: 0,
    skipped: 0,
    results: [],
  };

  for (const message of messages) {
    const event = toInboundEvent(message);
    if (!event.channelType || !event.externalAssetId) {
      summary.skipped += 1;
      continue;
    }

    const result = await routeInboundEvent(event);
    if (result.routed) {
      summary.routed += 1;
      if (result.duplicate) {
        summary.duplicates += 1;
      }
    } else if (result.quarantined) {
      summary.quarantined += 1;
    } else {
      summary.skipped += 1;
    }

    summary.results.push({
      inboundId: message._id || null,
      channelType: event.channelType,
      externalAssetId: event.externalAssetId,
      ...result,
    });
  }

  return summary;
}

module.exports = {
  inboundMessagesUrl,
  fetchInboundMessages,
  syncInboundMessages,
  toInboundEvent,
};
