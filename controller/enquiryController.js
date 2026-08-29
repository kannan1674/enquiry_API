import { Enquiry, Tenant, TenantChannelAsset, PipelineStage, User } from '../models/index.js';
import { loadAuthorisedClientIds } from '../middleware/auth.js';
import { syncInboundMessages } from '../services/inboundSync.js';

function serializeEnquiry(enquiry) {
  return {
    id: enquiry.id,
    tenantId: enquiry.tenantId,
    companyName: enquiry.Tenant?.companyName || null,
    clientCode: enquiry.Tenant?.clientCode || null,
    channelType: enquiry.channelType,
    contactName: enquiry.contactName,
    contactPhone: enquiry.contactPhone,
    contactEmail: enquiry.contactEmail,
    message: enquiry.message,
    status: enquiry.status,
    assetName: enquiry.TenantChannelAsset?.displayName || null,
    assetExternalId: enquiry.TenantChannelAsset?.externalId || null,
    stageName: enquiry.PipelineStage?.name || null,
    createdAt: enquiry.createdAt,
  };
}

async function accessibleTenantIds(user) {
  if (user.role === 'agency_super_admin') {
    return null;
  }

  if (user.role === 'agency_manager' || user.role === 'agency_agent') {
    const fresh = await User.findByPk(user.id);
    return loadAuthorisedClientIds(fresh);
  }

  return user.tenantId ? [Number(user.tenantId)] : [];
}

async function listEnquiries(req, res, next) {
  try {
    const allowedIds = await accessibleTenantIds(req.user);
    const where = {};

    if (req.query.tenantId) {
      const tenantId = Number(req.query.tenantId);
      if (allowedIds && !allowedIds.includes(tenantId)) {
        return res.status(403).json({ success: false, message: 'Tenant access denied' });
      }
      where.tenantId = tenantId;
    } else if (allowedIds) {
      if (allowedIds.length === 0) {
        return res.json({ success: true, enquiries: [] });
      }
      where.tenantId = allowedIds;
    }

    const items = await Enquiry.findAll({
      where,
      include: [
        { model: Tenant, attributes: ['id', 'companyName', 'clientCode'] },
        { model: TenantChannelAsset, attributes: ['id', 'displayName', 'externalId', 'channelType'] },
        { model: PipelineStage, attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 200,
    });

    return res.json({
      success: true,
      enquiries: items.map(serializeEnquiry),
    });
  } catch (error) {
    return next(error);
  }
}

async function syncInbound(req, res, next) {
  try {
    const summary = await syncInboundMessages();
    return res.json({
      success: true,
      message:
        summary.quarantined > 0
          ? `${summary.routed} enquiry(s) matched a mapped ID. ${summary.quarantined} went to quarantine.`
          : `${summary.routed} enquiry(s) pulled from WhatsApp.`,
      ...summary,
    });
  } catch (error) {
    return next(error);
  }
}

export {
  listEnquiries,
  syncInbound,
};
