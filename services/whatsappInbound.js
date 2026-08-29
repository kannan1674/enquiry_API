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

  await InboundMessage.sync({ alter: true });

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id || null;
      const displayPhone = value.metadata?.display_phone_number || null;
      const contacts = value.contacts || [];

      for (const message of value.messages || []) {
        const referral = referralFromMessage(message);
        const asset = await findWhatsappAsset(phoneNumberId, value.metadata?.waba_id);
        const tenantId = asset?.tenantId || null;
        const text = messageText(message);
        const receivedAt = message.timestamp
          ? new Date(Number(message.timestamp) * 1000)
          : new Date();

        console.log('Incoming WhatsApp message:', {
          from: message.from,
          text,
          id: message.id,
          timestamp: message.timestamp,
          phoneNumberId,
          adId: referral.adId,
        });

        const record = await InboundMessage.create({
          clientId: tenantId,
          tenantId,
          source: 'whatsapp',
          externalId: phoneNumberId || message.id,
          customerName: contacts[0]?.profile?.name || '',
          customerNumber: message.from || '',
          customerWaId: message.from || null,
          message: text,
          whatsappMessageId: message.id || '',
          status: 'new',
          rawPayload: body,
          metaBusinessId: asset?.metadata?.metaBusinessId || null,
          wabaId: asset?.metadata?.wabaId || value.metadata?.waba_id || null,
          phoneNumberId,
          adId: referral.adId,
          campaignId: referral.campaignId,
          referralSource: referral.referralSource,
          receivedAt,
        });

        if (phoneNumberId) {
          await routeInboundEvent({
            channelType: 'whatsapp',
            externalAssetId: String(phoneNumberId),
            externalEventId: message.id || null,
            contactName: contacts[0]?.profile?.name || null,
            contactPhone: message.from || displayPhone || null,
            message: text,
            payload: {
              ...body,
              referral: message.referral || null,
              adId: referral.adId,
              campaignId: referral.campaignId,
            },
          }).catch((error) => {
            console.error('Enquiry routing error:', error.message);
          });
        }

        saved.push(record);
      }
    }
  }

  return saved;
}
