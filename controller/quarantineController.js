import { QuarantinedInboundEvent, Tenant, TenantChannelAsset } from '../models/index.js';
import { routeInboundEvent } from '../services/inboundRouter.js';

function serializeQuarantine(item) {
  return {
    id: item.id,
    channelType: item.channelType,
    externalAssetId: item.externalAssetId,
    externalEventId: item.externalEventId,
    payload: item.payload,
    status: item.status,
    resolvedTenantId: item.resolvedTenantId,
    receivedAt: item.receivedAt,
    resolvedTenant: item.resolvedTenant
      ? {
          id: item.resolvedTenant.id,
          companyName: item.resolvedTenant.companyName,
          clientCode: item.resolvedTenant.clientCode,
        }
      : null,
  };
}

async function listQuarantine(req, res, next) {
  try {
    const where = {};
    if (req.query.status) {
      where.status = req.query.status;
    }

    const items = await QuarantinedInboundEvent.findAll({
      where,
      include: [{ model: Tenant, as: 'resolvedTenant', attributes: ['id', 'companyName', 'clientCode'] }],
      order: [['receivedAt', 'DESC']],
      limit: 200,
    });

    return res.json({ success: true, items: items.map(serializeQuarantine) });
  } catch (error) {
    return next(error);
  }
}

async function mapQuarantine(req, res, next) {
  try {
    const item = await QuarantinedInboundEvent.findByPk(req.params.id);
    if (!item || item.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Quarantine item not found' });
    }

    const tenantId = Number(req.body?.tenantId);
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim()
        : item.externalAssetId;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant is required to map this asset' });
    }

    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant || tenant.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Invalid tenant' });
    }

    const existing = await TenantChannelAsset.findOne({
      where: { channelType: item.channelType, externalId: item.externalAssetId },
    });
    if (existing && Number(existing.tenantId) !== tenantId) {
      return res.status(409).json({
        success: false,
        message: 'This asset is already mapped to another client',
      });
    }

    if (!existing) {
      await TenantChannelAsset.create({
        tenantId,
        channelType: item.channelType,
        externalId: item.externalAssetId,
        displayName,
        status: 'active',
      });
    }

    const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
    const routed = await routeInboundEvent({
      channelType: item.channelType,
      externalAssetId: item.externalAssetId,
      externalEventId: item.externalEventId,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
      message: payload.message,
      payload,
    });

    await item.update({
      status: 'mapped',
      resolvedTenantId: tenantId,
    });

    return res.json({
      success: true,
      message: 'Asset mapped. Event reprocessed against the mapped client only',
      routed,
    });
  } catch (error) {
    return next(error);
  }
}

async function dismissQuarantine(req, res, next) {
  try {
    const item = await QuarantinedInboundEvent.findByPk(req.params.id);
    if (!item || item.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Quarantine item not found' });
    }
    await item.update({ status: 'dismissed' });
    return res.json({ success: true, message: 'Quarantine item dismissed' });
  } catch (error) {
    return next(error);
  }
}

export {
  listQuarantine,
  mapQuarantine,
  dismissQuarantine,
};
