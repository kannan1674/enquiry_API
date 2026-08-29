import { InboundMessage, TenantChannelAsset } from '../models/index.js';
import { routeInboundEvent } from './inboundRouter.js';

function messageText(message) {
  return (
    message.text?.body
    || message.button?.text
    || message.interactive?.button_reply?.title
    || message.interactive?.list_reply?.title
    || ''
  );
}

function referralFromMessage(message = {}) {
  const referral = message.referral || {};
  return {
    adId: referral.source_id || referral.ad_id || null,
    campaignId: referral.campaign_id || null,
    referralSource: referral.source_type || referral.source || null,
  };
}

async function findWhatsappAsset(phoneNumberId, wabaId) {
  if (phoneNumberId) {
    const byPhone = await TenantChannelAsset.findOne({
      where: {
        channelType: 'whatsapp',
        externalId: String(phoneNumberId),
        status: 'active',
      },
    });
    if (byPhone) {
      return byPhone;
    }
  }

  if (!wabaId) {
    return null;
  }

  const assets = await TenantChannelAsset.findAll({
    where: { channelType: 'whatsapp', status: 'active' },
  });
  return assets.find((asset) => asset.metadata?.wabaId === String(wabaId)) || null;
}

export async function saveWhatsappWebhookMessages(body = {}) {
  const saved = [];
  const entries = body.entry || [];
  const assetCache = new Map();

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const messages = value.messages || [];
      if (!messages.length) {
        continue;
      }

      const phoneNumberId = value.metadata?.phone_number_id || null;
      const displayPhone = value.metadata?.display_phone_number || null;
      const contacts = value.contacts || [];
      const wabaId = value.metadata?.waba_id || null;
      const cacheKey = `${phoneNumberId || ''}:${wabaId || ''}`;
      if (!assetCache.has(cacheKey)) {
        assetCache.set(cacheKey, await findWhatsappAsset(phoneNumberId, wabaId));
      }
      const asset = assetCache.get(cacheKey);

      for (const message of messages) {
        const referral = referralFromMessage(message);
        const tenantId = asset?.tenantId || null;
        const text = messageText(message);
        const receivedAt = message.timestamp
          ? new Date(Number(message.timestamp) * 1000)
          : new Date();
        const whatsappMessageId = message.id || '';
        const payload = {
          clientId: tenantId,
          tenantId,
          source: 'whatsapp',
          externalId: phoneNumberId || message.id,
          customerName: contacts[0]?.profile?.name || '',
          customerNumber: message.from || '',
          customerWaId: message.from || null,
          message: text,
          whatsappMessageId,
          status: 'new',
          rawPayload: {
            message,
            referral: message.referral || null,
            metadata: value.metadata || null,
          },
          metaBusinessId: asset?.metadata?.metaBusinessId || null,
          wabaId: asset?.metadata?.wabaId || wabaId,
          phoneNumberId,
          adId: referral.adId,
          campaignId: referral.campaignId,
          referralSource: referral.referralSource,
          receivedAt,
        };

        let record;
        let created = true;
        if (whatsappMessageId) {
          [record, created] = await InboundMessage.findOrCreate({
            where: { whatsappMessageId },
            defaults: payload,
          });
        } else {
          record = await InboundMessage.create(payload);
        }

        if (created && phoneNumberId) {
          await routeInboundEvent({
            channelType: 'whatsapp',
            externalAssetId: String(phoneNumberId),
            externalEventId: message.id || null,
            contactName: contacts[0]?.profile?.name || null,
            contactPhone: message.from || displayPhone || null,
            message: text,
            payload: {
              referral: message.referral || null,
              adId: referral.adId,
              campaignId: referral.campaignId,
            },
          }, asset).catch((error) => {
            console.error('Enquiry routing error:', error.message);
          });
        }

        saved.push(record);
      }
    }
  }

  return saved;
}
