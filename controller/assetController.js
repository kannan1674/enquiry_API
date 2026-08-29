const { TenantChannelAsset } = require('../models');
const { CHANNEL_TYPES, isChannelType } = require('../services/inboundRouter');

function serializeAsset(asset) {
  return {
    id: asset.id,
    tenantId: asset.tenantId,
    channelType: asset.channelType,
    externalId: asset.externalId,
    displayName: asset.displayName,
    status: asset.status,
    metadata: asset.metadata,
    createdAt: asset.createdAt,
  };
}

async function listAssets(req, res, next) {
  try {
    const assets = await TenantChannelAsset.findAll({
      where: { tenantId: req.tenantId },
      order: [['channelType', 'ASC'], ['displayName', 'ASC']],
    });
    return res.json({
      success: true,
      channelTypes: CHANNEL_TYPES,
      assets: assets.map(serializeAsset),
    });
  } catch (error) {
    return next(error);
  }
}

async function createAsset(req, res, next) {
  try {
    const channelType = req.body?.channelType;
    const externalId = typeof req.body?.externalId === 'string' ? req.body.externalId.trim() : '';
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim()
        : externalId;

    if (!isChannelType(channelType)) {
      return res.status(400).json({ success: false, message: 'Invalid channel type' });
    }
    if (!externalId) {
      return res.status(400).json({ success: false, message: 'External asset ID is required' });
    }

    const existing = await TenantChannelAsset.findOne({
      where: { channelType, externalId },
    });
    if (existing) {
      if (Number(existing.tenantId) === Number(req.tenantId)) {
        await existing.update({
          displayName,
          status: 'active',
          metadata: req.body?.metadata || existing.metadata,
        });
        return res.json({
          success: true,
          alreadyMapped: true,
          message: 'This WhatsApp ID is already mapped to this client',
          asset: serializeAsset(existing),
        });
      }
      return res.status(409).json({
        success: false,
        message: 'This asset is already mapped to another client and cannot be guessed or reassigned here',
      });
    }

    const asset = await TenantChannelAsset.create({
      tenantId: req.tenantId,
      channelType,
      externalId,
      displayName,
      status: 'active',
      metadata: req.body?.metadata || null,
    });

    return res.status(201).json({ success: true, asset: serializeAsset(asset) });
  } catch (error) {
    return next(error);
  }
}

async function updateAsset(req, res, next) {
  try {
    const asset = await TenantChannelAsset.findOne({
      where: { id: req.params.assetId, tenantId: req.tenantId },
    });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const updates = {};
    if (typeof req.body?.displayName === 'string' && req.body.displayName.trim()) {
      updates.displayName = req.body.displayName.trim();
    }
    if (req.body?.status === 'active' || req.body?.status === 'disabled') {
      updates.status = req.body.status;
    }
    if (req.body?.metadata && typeof req.body.metadata === 'object') {
      updates.metadata = req.body.metadata;
    }

    await asset.update(updates);
    return res.json({ success: true, asset: serializeAsset(asset) });
  } catch (error) {
    return next(error);
  }
}

async function deleteAsset(req, res, next) {
  try {
    const asset = await TenantChannelAsset.findOne({
      where: { id: req.params.assetId, tenantId: req.tenantId },
    });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    await asset.destroy();
    return res.json({ success: true, message: 'Asset unmapped' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listAssets,
  createAsset,
  updateAsset,
  deleteAsset,
};
