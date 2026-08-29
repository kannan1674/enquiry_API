import { Enquiry, Tenant, TenantChannelAsset, PipelineStage } from '../models/index.js';
import { resolveAccessibleTenantIds } from '../middleware/auth.js';
import { syncInboundMessages, syncRecentInboundMessages } from '../services/inboundSync.js';
import {
  ENQUIRY_STATUSES,
  canEditEnquiryStatus,
  isValidEnquiryStatus,
  statusLabel,
} from '../services/enquiryStatus.js';

function enquiryTimestamp(enquiry) {
  const raw = typeof enquiry.get === 'function' ? enquiry.get({ plain: true }) : enquiry;
  const value = raw.createdAt || raw.created_at || raw.updatedAt || raw.updated_at;
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

const IST_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

function formatIst(date) {
  const parts = IST_FORMATTER.formatToParts(date);

  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  const datePart = `${pick('day')} ${pick('month')} ${pick('year')}`;
  const timePart = `${pick('hour')}:${pick('minute')} ${pick('dayPeriod')}`.trim();

  return {
    iso: date.toISOString(),
    date: datePart,
    time: timePart,
    ist: `${datePart}, ${timePart} IST`,
  };
}

function serializeEnquiry(enquiry, user = null) {
  const timestamp = formatIst(enquiryTimestamp(enquiry));
  const status = enquiry.status || 'open';

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
    status,
    statusLabel: statusLabel(status),
    canEditStatus: canEditEnquiryStatus(user, enquiry),
    assetName: enquiry.TenantChannelAsset?.displayName || null,
    assetExternalId: enquiry.TenantChannelAsset?.externalId || null,
    stageName: enquiry.PipelineStage?.name || null,
    createdAt: timestamp.iso,
    created_at: timestamp.iso,
    createdAtIst: timestamp.ist,
    date: timestamp.date,
    time: timestamp.time,
  };
}

async function accessibleTenantIds(user) {
  return resolveAccessibleTenantIds(user);
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
        return res.json({
          success: true,
          canEditStatus: canEditEnquiryStatus(req.user),
          statuses: ENQUIRY_STATUSES,
          enquiries: [],
        });
      }
      where.tenantId = allowedIds;
    }

    await syncRecentInboundMessages().catch(() => null);

    const items = await Enquiry.findAll({
      where,
      attributes: { exclude: ['payload'] },
      include: [
        { model: Tenant, attributes: ['id', 'companyName', 'clientCode'] },
        { model: TenantChannelAsset, attributes: ['id', 'displayName', 'externalId', 'channelType'] },
        { model: PipelineStage, attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 200,
    });

    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      canEditStatus: canEditEnquiryStatus(req.user),
      statuses: ENQUIRY_STATUSES,
      serverTime: new Date().toISOString(),
      enquiries: items.map((item) => serializeEnquiry(item, req.user)),
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

async function listEnquiryStatuses(req, res) {
  return res.json({
    success: true,
    canEditStatus: canEditEnquiryStatus(req.user),
    statuses: ENQUIRY_STATUSES,
  });
}

async function updateEnquiryStatus(req, res, next) {
  try {
    if (!canEditEnquiryStatus(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin and business owner can change enquiry status',
      });
    }

    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    if (!isValidEnquiryStatus(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Use one of: ${ENQUIRY_STATUSES.map((item) => item.value).join(', ')}`,
        statuses: ENQUIRY_STATUSES,
      });
    }

    const enquiry = await Enquiry.findByPk(req.params.enquiryId, {
      attributes: { exclude: ['payload'] },
      include: [
        { model: Tenant, attributes: ['id', 'companyName', 'clientCode'] },
        { model: TenantChannelAsset, attributes: ['id', 'displayName', 'externalId', 'channelType'] },
        { model: PipelineStage, attributes: ['id', 'name'] },
      ],
    });

    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    const allowedIds = await accessibleTenantIds(req.user);
    if (allowedIds && !allowedIds.includes(Number(enquiry.tenantId))) {
      return res.status(403).json({ success: false, message: 'Tenant access denied' });
    }
    if (!canEditEnquiryStatus(req.user, enquiry)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin and business owner can change enquiry status',
      });
    }

    await enquiry.update({ status });
    return res.json({
      success: true,
      message: `Status updated to ${statusLabel(status)}`,
      enquiry: serializeEnquiry(enquiry, req.user),
    });
  } catch (error) {
    return next(error);
  }
}

export {
  listEnquiries,
  listEnquiryStatuses,
  updateEnquiryStatus,
  syncInbound,
};
