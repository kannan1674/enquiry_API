import { InboundMessage } from '../models/index.js';
import { routeInboundEvent } from './inboundRouter.js';

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
  return (process.env.INBOUND_MESSAGES_URL || '').replace(/\/$/, '');
}

function channelFromSource(source) {
  return SOURCE_TO_CHANNEL[String(source || '').toLowerCase()] || null;
}

function toInboundEvent(message = {}) {
  const channelType = channelFromSource(message.source) || (message.phoneNumberId ? 'whatsapp' : null);
  const externalAssetId = message.phoneNumberId || message.externalId || null;
  const rawPayload = message.rawPayload && typeof message.rawPayload === 'object' ? message.rawPayload : message;

  return {
    channelType,
    externalAssetId: externalAssetId ? String(externalAssetId) : null,
    externalEventId: message.whatsappMessageId || message.externalEventId || message.id || null,
    contactName: message.customerName || null,
    contactPhone: message.customerNumber || message.customerWaId || null,
    message: message.message || null,
    payload: {
      ...rawPayload,
      inboundId: message.id || null,
      contactName: message.customerName || null,
      contactPhone: message.customerNumber || null,
      message: message.message || null,
      adId: message.adId || null,
      campaignId: message.campaignId || null,
    },
  };
}

async function fetchLocalInboundMessages() {
  await InboundMessage.sync();
  const rows = await InboundMessage.findAll({
    order: [['receivedAt', 'DESC']],
    limit: 200,
  });
  return rows.map((row) => row.toJSON());
}

async function fetchRemoteInboundMessages() {
  const url = inboundMessagesUrl();
  if (!url) {
    return [];
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return Array.isArray(data.messages) ? data.messages : [];
  } catch {
    return [];
  }
}

async function fetchInboundMessages() {
  const local = await fetchLocalInboundMessages();
  if (local.length) {
    return local;
  }
  return fetchRemoteInboundMessages();
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
      inboundId: message.id || message._id || null,
      channelType: event.channelType,
      externalAssetId: event.externalAssetId,
      ...result,
    });
  }

  return summary;
}

export {
  inboundMessagesUrl,
  fetchInboundMessages,
  syncInboundMessages,
  toInboundEvent,
};
