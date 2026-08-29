import jwt from 'jsonwebtoken';
import { UserMetaConnection, TenantChannelAsset, Tenant } from '../models/index.js';
import { graphConfigured, buildAuthUrl, exchangeCodeForToken, exchangeJsSdkCode } from '../services/metaGraph.js';
import { metaSettings, saveMetaSettings } from '../services/metaSettings.js';
import {
  resolveImportTenant,
  saveConnectionAndImport,
  syncStoredConnection,
  upsertDiscoveredAssets,
} from '../services/metaImport.js';

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return '/connections';
  }
  return value;
}

function redirectWith(res, returnTo, params) {
  const url = new URL(safeReturnTo(returnTo), frontendUrl());
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return res.redirect(url.toString());
}

function serializeConnection(connection, assets, tenant) {
  return {
    configured: graphConfigured(),
    appId: metaSettings().appId || null,
    configId: metaSettings().configId || null,
    graphVersion: metaSettings().graphVersion || 'v21.0',
    connected: Boolean(connection),
    facebookName: connection?.facebookName || null,
    facebookUserId: connection?.facebookUserId || null,
    lastSyncedAt: connection?.lastSyncedAt || null,
    tenantId: tenant?.id || null,
    companyName: tenant?.companyName || null,
    assets: (assets || []).map((asset) => ({
      id: asset.id,
      channelType: asset.channelType,
      externalId: asset.externalId,
      displayName: asset.displayName,
      tenantId: asset.tenantId,
    })),
  };
}

async function setupApp(req, res, next) {
  try {
    const appId = typeof req.body?.appId === 'string' ? req.body.appId.trim() : '';
    const appSecret = typeof req.body?.appSecret === 'string' ? req.body.appSecret.trim() : '';
    const configId = typeof req.body?.configId === 'string' ? req.body.configId.trim() : '';
    if (!appId || !appSecret) {
      return res.status(400).json({ success: false, message: 'App ID and App Secret are required' });
    }
    const saved = saveMetaSettings({ appId, appSecret, configId });
    return res.json({
      success: true,
      message: 'Facebook login is on. Click Continue with Facebook.',
      appId: saved.appId,
      configId: saved.configId || null,
    });
  } catch (error) {
    return next(error);
  }
}

async function getStatus(req, res, next) {
  try {
    const connection = await UserMetaConnection.findOne({ where: { userId: req.user.id } });
    const assets = await TenantChannelAsset.findAll({
      where: { connectedByUserId: req.user.id },
      order: [['channelType', 'ASC'], ['displayName', 'ASC']],
    });
    const tenant = assets[0] ? await Tenant.findByPk(assets[0].tenantId) : null;
    return res.json({ success: true, ...serializeConnection(connection, assets, tenant) });
  } catch (error) {
    return next(error);
  }
}

async function getConnectUrl(req, res, next) {
  try {
    if (!graphConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Facebook App ID and App Secret are not configured on the server',
      });
    }

    const returnTo = safeReturnTo(req.query.returnTo);
    const tenantId = await resolveImportTenant(req.user, req.query.tenantId);
    const state = jwt.sign(
      {
        purpose: 'meta_oauth',
        userId: req.user.id,
        tenantId,
        returnTo,
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    return res.json({
      success: true,
      url: buildAuthUrl(state),
      tenantId,
    });
  } catch (error) {
    return next(error);
  }
}

async function callback(req, res) {
  const returnToFallback = '/connections';
  try {
    if (req.query.error) {
      return redirectWith(res, returnToFallback, {
        meta: 'error',
        message: req.query.error_description || req.query.error,
      });
    }

    const { code, state } = req.query;
    if (!code || !state) {
      return redirectWith(res, returnToFallback, {
        meta: 'error',
        message: 'Facebook login did not return a code',
      });
    }

    const payload = jwt.verify(state, process.env.JWT_SECRET);
    if (payload.purpose !== 'meta_oauth' || !payload.userId || !payload.tenantId) {
      return redirectWith(res, returnToFallback, {
        meta: 'error',
        message: 'Facebook login state is invalid',
      });
    }

    const token = await exchangeCodeForToken(String(code));
    const imported = await saveConnectionAndImport({
      userId: payload.userId,
      tenantId: payload.tenantId,
      accessToken: token.access_token,
      expiresIn: token.expires_in,
    });

    return redirectWith(res, payload.returnTo || returnToFallback, {
      meta: 'connected',
      whatsapp: imported.whatsappCount,
      phoneNumberId: imported.phoneNumberId || '',
      pages: imported.pageCount,
      instagram: imported.instagramCount,
      skipped: imported.skipped.length,
    });
  } catch (error) {
    return redirectWith(res, returnToFallback, {
      meta: 'error',
      message: error.message || 'Facebook login failed',
    });
  }
}

function extraAssetsFromBody(body = {}) {
  const extras = [];
  if (body.phoneNumberId) {
    extras.push({
      channelType: 'whatsapp',
      externalId: String(body.phoneNumberId).trim(),
      displayName: body.verifiedName || body.displayPhoneNumber || 'WhatsApp',
      metadata: {
        source: 'facebook_login',
        wabaId: body.wabaId || null,
        displayPhoneNumber: body.displayPhoneNumber || null,
      },
    });
  }
  if (body.pageId) {
    extras.push({
      channelType: 'facebook_page',
      externalId: String(body.pageId).trim(),
      displayName: body.pageName || 'Facebook Page',
      metadata: { source: 'facebook_login' },
    });
  }
  return extras;
}

async function completeLogin(req, res, next) {
  try {
    if (!graphConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Facebook Login for Business is not turned on for this app yet',
      });
    }

    const tenantId = await resolveImportTenant(req.user, req.body?.tenantId);
    const extras = extraAssetsFromBody(req.body);
    let tokenData = null;

    if (req.body?.accessToken) {
      tokenData = { access_token: req.body.accessToken, expires_in: req.body.expiresIn || null };
    } else if (req.body?.code) {
      tokenData = await exchangeJsSdkCode(String(req.body.code)).catch(() => null);
      if (!tokenData) {
        tokenData = await exchangeCodeForToken(String(req.body.code)).catch(() => null);
      }
    }

    let imported;
    if (tokenData?.access_token) {
      imported = await saveConnectionAndImport({
        userId: req.user.id,
        tenantId,
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in,
        extraAssets: extras,
      });
    } else if (extras.length) {
      const result = await upsertDiscoveredAssets({
        tenantId,
        userId: req.user.id,
        assets: extras,
      });
      imported = {
        companyName: null,
        ...result,
        whatsappCount: result.imported.filter((item) => item.channelType === 'whatsapp').length,
        pageCount: result.imported.filter((item) => item.channelType === 'facebook_page').length,
        instagramCount: 0,
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Facebook login finished, but no WhatsApp number was shared. Allow WhatsApp access and try again.',
      });
    }

    return res.json({
      success: true,
      message: imported.whatsappCount
        ? `Connected. ${imported.whatsappCount} WhatsApp number(s) were added automatically.`
        : 'Facebook connected. No WhatsApp number was found on that account yet.',
      ...imported,
    });
  } catch (error) {
    return next(error);
  }
}

async function syncConnection(req, res, next) {
  try {
    const imported = await syncStoredConnection(req.user, req.body?.tenantId || req.query.tenantId);
    return res.json({
      success: true,
      message: imported.whatsappCount
        ? `Imported ${imported.whatsappCount} WhatsApp number(s) for ${imported.companyName}`
        : 'Facebook is connected. No WhatsApp numbers were returned for this account.',
      ...imported,
    });
  } catch (error) {
    return next(error);
  }
}

export {
  setupApp,
  getStatus,
  getConnectUrl,
  callback,
  completeLogin,
  syncConnection,
};
