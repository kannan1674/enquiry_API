import { TenantChannelAsset, UserMetaConnection, User, Tenant } from '../models/index.js';
import { loadAuthorisedClientIds } from '../middleware/auth.js';
import {
  discoverBusinessAssets,
  exchangeLongLivedToken,
  subscribeWabaWebhook,
} from './metaGraph.js';

async function resolveImportTenant(userPayload, requestedTenantId) {
  const user = await User.findByPk(userPayload.id || userPayload.userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 401 });
  }

  const allowedIds = await loadAuthorisedClientIds(user);
  const requested = Number(requestedTenantId);

  if (requested) {
    if (user.role !== 'agency_super_admin' && !allowedIds.includes(requested)) {
      throw Object.assign(new Error('You cannot connect Facebook to that client'), { status: 403 });
    }
    return requested;
  }

  if (user.tenantId) {
    return Number(user.tenantId);
  }

  if (allowedIds.length === 1) {
    return Number(allowedIds[0]);
  }

  throw Object.assign(new Error('Choose a client before connecting Facebook Business'), { status: 400 });
}

async function upsertDiscoveredAssets({ tenantId, userId, assets }) {
  const imported = [];
  const skipped = [];

  for (const item of assets) {
    const existing = await TenantChannelAsset.findOne({
      where: { channelType: item.channelType, externalId: item.externalId },
    });

    if (existing) {
      if (Number(existing.tenantId) !== Number(tenantId)) {
        skipped.push({
          channelType: item.channelType,
          externalId: item.externalId,
          displayName: item.displayName,
          reason: 'already_mapped_to_another_client',
        });
        continue;
      }

      await existing.update({
        displayName: item.displayName,
        status: 'active',
        connectedByUserId: userId,
        metadata: {
          ...(existing.metadata || {}),
          ...(item.metadata || {}),
          source: 'facebook_login',
        },
      });
      imported.push({ ...item, alreadyMapped: true, assetId: existing.id });
      continue;
    }

    const created = await TenantChannelAsset.create({
      tenantId,
      channelType: item.channelType,
      externalId: item.externalId,
      displayName: item.displayName,
      status: 'active',
      connectedByUserId: userId,
      metadata: item.metadata || { source: 'facebook_login' },
    });
    imported.push({ ...item, alreadyMapped: false, assetId: created.id });
  }

  return { imported, skipped };
}

async function saveConnectionAndImport({ userId, tenantId, accessToken, expiresIn, extraAssets = [] }) {
  const longLived = await exchangeLongLivedToken(accessToken);
  const discovered = await discoverBusinessAssets(longLived);
  const merged = [...extraAssets, ...discovered.assets];
  const unique = [...new Map(merged.map((item) => [`${item.channelType}:${item.externalId}`, item])).values()];
  const result = await upsertDiscoveredAssets({
    tenantId,
    userId,
    assets: unique,
  });

  const expiresAt = expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : null;
  const existing = await UserMetaConnection.findOne({
    where: { userId, tenantId },
  }) || await UserMetaConnection.findOne({ where: { userId } });
  const payload = {
    userId,
    tenantId,
    facebookUserId: discovered.facebookUserId,
    facebookName: discovered.facebookName,
    accessToken: longLived,
    tokenExpiresAt: expiresAt,
    lastSyncedAt: new Date(),
  };

  if (existing) {
    await existing.update(payload);
  } else {
    await UserMetaConnection.create(payload);
  }

  const wabaIds = [...new Set(
    unique
      .filter((item) => item.channelType === 'whatsapp' && item.metadata?.wabaId)
      .map((item) => item.metadata.wabaId),
  )];
  await Promise.all(wabaIds.map((wabaId) => subscribeWabaWebhook(wabaId, longLived)));

  const tenant = await Tenant.findByPk(tenantId);

  return {
    facebookName: discovered.facebookName,
    tenantId,
    companyName: tenant?.companyName || null,
    ...result,
    whatsappCount: result.imported.filter((item) => item.channelType === 'whatsapp').length,
    pageCount: result.imported.filter((item) => item.channelType === 'facebook_page').length,
    instagramCount: result.imported.filter((item) => item.channelType === 'instagram').length,
    phoneNumberId:
      result.imported.find((item) => item.channelType === 'whatsapp')?.externalId || null,
  };
}

async function syncStoredConnection(userPayload, requestedTenantId) {
  const userId = userPayload.id || userPayload.userId;
  const tenantIdHint = requestedTenantId ? Number(requestedTenantId) : null;
  const connection = (tenantIdHint
    ? await UserMetaConnection.findOne({ where: { userId, tenantId: tenantIdHint } })
    : null)
    || await UserMetaConnection.findOne({
      where: { userId },
      order: [['lastSyncedAt', 'DESC']],
    });
  if (!connection) {
    throw Object.assign(new Error('Connect Facebook Business first'), { status: 400 });
  }

  const tenantId = await resolveImportTenant(userPayload, requestedTenantId);
  return saveConnectionAndImport({
    userId,
    tenantId,
    accessToken: connection.accessToken,
    expiresIn: null,
  });
}

export {
  resolveImportTenant,
  upsertDiscoveredAssets,
  saveConnectionAndImport,
  syncStoredConnection,
};
