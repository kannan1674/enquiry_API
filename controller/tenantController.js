const { Tenant, User, UserAuthorisedClient, PipelineStage, TenantChannelAsset, UserInvite } = require('../models');
const { slugifyClientCode, seedDefaultPipeline } = require('../services/tenantSetup');
const { loadAuthorisedClientIds } = require('../middleware/auth');

const TENANT_INCLUDES = [
  { model: User, attributes: ['id'], required: false },
  { model: TenantChannelAsset, attributes: ['id', 'channelType'], required: false },
  { model: PipelineStage, attributes: ['id'], required: false },
  { model: UserInvite, attributes: ['id', 'acceptedAt'], required: false },
];

function serializeTenant(tenant) {
  const users = tenant.Users || [];
  const assets = tenant.TenantChannelAssets || [];
  const stages = tenant.PipelineStages || [];
  const invites = tenant.UserInvites || [];

  return {
    id: tenant.id,
    clientCode: tenant.clientCode,
    companyName: tenant.companyName,
    status: tenant.status,
    timezone: tenant.timezone,
    accountType: tenant.accountType,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    usersCount: users.length,
    pendingInvitesCount: invites.filter((invite) => !invite.acceptedAt).length,
    assetsCount: assets.length,
    stagesCount: stages.length,
    mappedChannels: [...new Set(assets.map((asset) => asset.channelType))],
  };
}

async function listTenants(req, res, next) {
  try {
    const where = {};
    if (req.query.status) {
      where.status = req.query.status;
    }

    const user = await User.findByPk(req.user.id);
    const allowedIds = await loadAuthorisedClientIds(user);
    if (!allowedIds.length) {
      return res.json({ success: true, tenants: [] });
    }
    where.id = allowedIds;

    const tenants = await Tenant.findAll({
      where,
      include: TENANT_INCLUDES,
      order: [['companyName', 'ASC']],
    });

    return res.json({ success: true, tenants: tenants.map(serializeTenant) });
  } catch (error) {
    return next(error);
  }
}

async function getTenant(req, res, next) {
  try {
    const tenant = await Tenant.findByPk(req.tenantId, { include: TENANT_INCLUDES });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    return res.json({ success: true, tenant: serializeTenant(tenant) });
  } catch (error) {
    return next(error);
  }
}

async function createTenant(req, res, next) {
  try {
    const companyName = typeof req.body?.companyName === 'string' ? req.body.companyName.trim() : '';
    const timezone =
      typeof req.body?.timezone === 'string' && req.body.timezone.trim()
        ? req.body.timezone.trim()
        : 'Asia/Kolkata';
    const clientCode =
      typeof req.body?.clientCode === 'string' && req.body.clientCode.trim()
        ? req.body.clientCode.trim().toLowerCase()
        : slugifyClientCode(companyName);

    if (!companyName) {
      return res.status(400).json({ success: false, message: 'Company name is required' });
    }

    const existing = await Tenant.findOne({ where: { clientCode } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Client code already exists' });
    }

    const tenant = await Tenant.create({
      companyName,
      clientCode,
      timezone,
      status: 'active',
      accountType: 'agency_client',
      agencyOwnerUserId: req.user.id,
    });

    await seedDefaultPipeline(tenant.id, PipelineStage);

    if (req.user.role !== 'agency_super_admin') {
      await UserAuthorisedClient.findOrCreate({
        where: { userId: req.user.id, tenantId: tenant.id },
        defaults: { userId: req.user.id, tenantId: tenant.id },
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Client tenant created',
      tenant: serializeTenant(tenant),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateTenant(req, res, next) {
  try {
    const tenant = await Tenant.findByPk(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const updates = {};
    if (typeof req.body?.companyName === 'string' && req.body.companyName.trim()) {
      updates.companyName = req.body.companyName.trim();
    }
    if (typeof req.body?.timezone === 'string' && req.body.timezone.trim()) {
      updates.timezone = req.body.timezone.trim();
    }
    if (['active', 'suspended', 'archived'].includes(req.body?.status)) {
      updates.status = req.body.status;
    }

    await tenant.update(updates);
    return res.json({ success: true, tenant: serializeTenant(tenant) });
  } catch (error) {
    return next(error);
  }
}

async function listTenantUsers(req, res, next) {
  try {
    const users = await User.findAll({
      where: { tenantId: req.tenantId },
      attributes: ['id', 'name', 'email', 'mobile', 'role', 'status', 'lastLogin'],
      order: [['name', 'ASC']],
    });
    return res.json({ success: true, users });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  listTenantUsers,
};
