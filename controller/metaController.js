import jwt from 'jsonwebtoken';
import { UserMetaConnection, TenantChannelAsset, Tenant } from '../models/index.js';
import {
  graphConfigured,
  buildAuthUrl,
  exchangeCodeForToken,
  exchangeJsSdkCode,
} from '../services/metaGraph.js';
import {
  isAppConfigured,
  loadMetaSettings,
  metaSettings,
  saveMetaSettings,
} from '../services/metaSettings.js';
import {
  resolveImportTenant,
  saveConnectionAndImport,
  syncStoredConnection,
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

function serializeAssets(assets) {
  return (assets || []).map((asset) => ({
    id: asset.id,
    channelType: asset.channelType,
    externalId: asset.externalId,
    displayName: asset.displayName,
    tenantId: asset.tenantId,
  }));
}

function completePayload(imported) {
  return {
    success: true,
    message: 'Facebook connected',
    whatsappCount: imported.whatsappCount || 0,
    pageCount: imported.pageCount || 0,
    instagramCount: imported.instagramCount || 0,
    companyName: imported.companyName || null,
  };
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
  if (body.wabaId && !body.phoneNumberId) {
    extras.push({
      channelType: 'whatsapp',
      externalId: String(body.wabaId).trim(),
      displayName: body.verifiedName || 'WhatsApp Business Account',
      metadata: {
        source: 'facebook_login',
        wabaId: body.wabaId,
      },
    });
  }
  return extras;
}

export async function setupApp(req, res, next) {
  try {
    const appId = typeof req.body?.appId === 'string' ? req.body.appId.trim() : '';
    const appSecret = typeof req.body?.appSecret === 'string' ? req.body.appSecret.trim() : '';
    const configId = typeof req.body?.configId === 'string' ? req.body.configId.trim() : '';

    if (!appId || !appSecret) {
      return res.status(400).json({
        success: false,
        message: 'App ID and App Secret are required',
      });
    }

    const saved = await saveMetaSettings({ appId, appSecret, configId });
    return res.status(200).json({
      success: true,
      message: 'Facebook app saved',
      appId: saved.appId,
      configId: saved.configId,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getStatus(req, res, next) {
  try {
    await loadMetaSettings();
    const settings = metaSettings();

    let tenant = null;
    let tenantId = null;
    try {
      tenantId = await resolveImportTenant(req.user, req.query.tenantId);
      tenant = await Tenant.findByPk(tenantId);
    } catch (error) {
      if (error.status && error.status !== 400) {
        throw error;
      }
    }

    const connection = tenantId
      ? await UserMetaConnection.findOne({
          where: { userId: req.user.id, tenantId },
        }) || await UserMetaConnection.findOne({
          where: { userId: req.user.id },
          order: [['lastSyncedAt', 'DESC']],
        })
      : await UserMetaConnection.findOne({
          where: { userId: req.user.id },
          order: [['lastSyncedAt', 'DESC']],
        });

    const assets = tenantId
      ? await TenantChannelAsset.findAll({
          where: { tenantId },
          order: [['channelType', 'ASC'], ['displayName', 'ASC']],
        })
      : [];

    if (!tenant && assets[0]) {
      tenant = await Tenant.findByPk(assets[0].tenantId);
      tenantId = tenant?.id || tenantId;
    }

    return res.status(200).json({
      success: true,
      configured: Boolean(settings.appId),
      appId: settings.appId || null,
      configId: settings.configId || null,
      graphVersion: settings.graphVersion || 'v21.0',
      connected: Boolean(connection),
      facebookName: connection?.facebookName || null,
      facebookUserId: connection?.facebookUserId || null,
      lastSyncedAt: connection?.lastSyncedAt || null,
      tenantId: tenant?.id || tenantId || null,
      companyName: tenant?.companyName || null,
      assets: serializeAssets(assets),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getConnectUrl(req, res, next) {
  try {
    await loadMetaSettings();
    if (!isAppConfigured() || !graphConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Meta app is not set up yet',
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

    return res.status(200).json({
      success: true,
      url: buildAuthUrl(state),
      tenantId,
    });
  } catch (error) {
    return next(error);
  }
}

export async function callback(req, res) {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code missing',
      });
    }

    await loadMetaSettings();

    const token = await exchangeCodeForToken(String(code));

    if (state) {
      const payload = jwt.verify(String(state), process.env.JWT_SECRET);
      if (payload.purpose === 'meta_oauth' && payload.userId && payload.tenantId) {
        await saveConnectionAndImport({
          userId: payload.userId,
          tenantId: payload.tenantId,
          accessToken: token.access_token,
          expiresIn: token.expires_in,
        });

        return redirectWith(res, payload.returnTo || '/connections', {
          meta: 'connected',
        });
      }
    }

    return res.redirect(`${frontendUrl()}/connections`);
  } catch (error) {
    console.error('Meta callback error:', error);

    return res.status(500).json({
      success: false,
      message: 'Meta authentication failed',
    });
  }
}

export async function completeLogin(req, res, next) {
  try {
    await loadMetaSettings();
    if (!graphConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Meta app is not set up yet',
      });
    }

    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const accessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
    if (!code && !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'code or accessToken is required',
      });
    }

    const tenantId = await resolveImportTenant(req.user, req.body?.tenantId);
    const extras = extraAssetsFromBody(req.body);
    let tokenData = null;

    if (accessToken) {
      tokenData = { access_token: accessToken, expires_in: req.body.expiresIn || null };
    } else {
      tokenData = await exchangeJsSdkCode(code).catch(() => null);
      if (!tokenData) {
        tokenData = await exchangeCodeForToken(code);
      }
    }

    const imported = await saveConnectionAndImport({
      userId: req.user.id,
      tenantId,
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
      extraAssets: extras,
    });

    return res.status(200).json(completePayload(imported));
  } catch (error) {
    return next(error);
  }
}

export async function syncConnection(req, res, next) {
  try {
    await loadMetaSettings();
    if (!graphConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Meta app is not set up yet',
      });
    }

    const imported = await syncStoredConnection(req.user, req.body?.tenantId || req.query.tenantId);
    return res.status(200).json(completePayload(imported));
  } catch (error) {
    return next(error);
  }
}
