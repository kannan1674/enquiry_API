import {
  TenantChannelAsset,
  PipelineStage,
  RoutingRule,
  Enquiry,
  QuarantinedInboundEvent,
} from '../models/index.js';

const CHANNEL_TYPES = ['facebook_page', 'instagram', 'lead_form', 'whatsapp'];

function isChannelType(value) {
  return CHANNEL_TYPES.includes(value);
}

async function findMappedAsset(channelType, externalId) {
  if (!isChannelType(channelType) || !externalId) {
    return null;
  }

  return TenantChannelAsset.findOne({
    where: {
      channelType,
      externalId: String(externalId).trim(),
      status: 'active',
    },
  });
}

async function resolveRouting(asset) {
  const rules = await RoutingRule.findAll({
    where: { tenantId: asset.tenantId },
    order: [['id', 'ASC']],
  });

  const assetRule = rules.find((rule) => Number(rule.assetId) === Number(asset.id));
  if (assetRule) {
    return assetRule;
  }

  const channelRule = rules.find(
    (rule) => !rule.assetId && rule.channelType === asset.channelType,
  );
  if (channelRule) {
    return channelRule;
  }

  const tenantRule = rules.find((rule) => !rule.assetId && !rule.channelType);
  if (tenantRule) {
    return tenantRule;
  }

  const defaultStage = await PipelineStage.findOne({
    where: { tenantId: asset.tenantId, isDefault: true },
    order: [['sortOrder', 'ASC']],
  });

  return {
    pipelineStageId: defaultStage?.id || null,
    assigneeUserId: null,
  };
}

async function quarantineUnknownAsset({ channelType, externalAssetId, externalEventId, payload }) {
  if (externalEventId) {
    const existing = await QuarantinedInboundEvent.findOne({
      where: {
        channelType,
        externalEventId: String(externalEventId),
      },
    });
    if (existing) {
      return existing;
    }
  }

  return QuarantinedInboundEvent.create({
    channelType,
    externalAssetId: String(externalAssetId).trim(),
    externalEventId: externalEventId ? String(externalEventId) : null,
    payload: payload || {},
    status: 'pending',
    receivedAt: new Date(),
  });
}

async function createEnquiryFromInbound({ asset, routing, event }) {
  if (event.externalEventId) {
    const existing = await Enquiry.findOne({
      where: {
        channelType: asset.channelType,
        externalEventId: String(event.externalEventId),
      },
    });
    if (existing) {
      return { enquiry: existing, duplicate: true };
    }
  }

  const enquiry = await Enquiry.create({
    tenantId: asset.tenantId,
    assetId: asset.id,
    channelType: asset.channelType,
    externalEventId: event.externalEventId ? String(event.externalEventId) : null,
    pipelineStageId: routing.pipelineStageId || null,
    assigneeUserId: routing.assigneeUserId || null,
    contactName: event.contactName || null,
    contactEmail: event.contactEmail || null,
    contactPhone: event.contactPhone || null,
    message: event.message || null,
    payload: event.payload || null,
    status: 'open',
  });

  return { enquiry, duplicate: false };
}

async function routeInboundEvent(event) {
  const channelType = event.channelType;
  const externalAssetId = event.externalAssetId;

  if (!isChannelType(channelType) || !externalAssetId) {
    return {
      routed: false,
      reason: 'invalid_event',
    };
  }

  const asset = await findMappedAsset(channelType, externalAssetId);
  if (!asset) {
    const quarantined = await quarantineUnknownAsset({
      channelType,
      externalAssetId,
      externalEventId: event.externalEventId,
      payload: event.payload || event,
    });
    return {
      routed: false,
      quarantined: true,
      quarantineId: quarantined.id,
      reason: 'unknown_asset',
    };
  }

  const routing = await resolveRouting(asset);
  const { enquiry, duplicate } = await createEnquiryFromInbound({ asset, routing, event });

  return {
    routed: true,
    duplicate,
    tenantId: asset.tenantId,
    assetId: asset.id,
    enquiryId: enquiry.id,
  };
}

export {
  CHANNEL_TYPES,
  isChannelType,
  findMappedAsset,
  resolveRouting,
  routeInboundEvent,
};
