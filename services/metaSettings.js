import { MetaAppConfig, UserMetaConnection, TenantChannelAsset } from '../models/index.js';
import { decryptSecret, encryptSecret } from './metaCrypto.js';

let settingsCache = null;
let tablesReady = false;

function envSettings() {
  return {
    appId: String(process.env.FACEBOOK_APP_ID || '').trim(),
    appSecret: String(process.env.FACEBOOK_APP_SECRET || '').trim(),
    configId: String(process.env.FACEBOOK_CONFIG_ID || '').trim(),
    graphVersion: String(process.env.META_GRAPH_VERSION || process.env.FACEBOOK_GRAPH_VERSION || 'v21.0').trim() || 'v21.0',
  };
}

function mergeSettings(stored) {
  const env = envSettings();
  return {
    appId: env.appId || stored?.appId || '',
    appSecret: env.appSecret || stored?.appSecret || '',
    configId: env.configId || stored?.configId || '',
    graphVersion: stored?.graphVersion || env.graphVersion,
  };
}

async function ensureTable() {
  if (tablesReady) {
    return;
  }
  await MetaAppConfig.sync();
  await UserMetaConnection.sync({ alter: true });
  await TenantChannelAsset.sync();
  tablesReady = true;
}

export function metaSettings() {
  return settingsCache || mergeSettings(null);
}

export function isAppConfigured() {
  return Boolean(metaSettings().appId);
}

export function graphConfigured() {
  const settings = metaSettings();
  return Boolean(settings.appId && settings.appSecret);
}

export async function loadMetaSettings() {
  await ensureTable();
  const row = await MetaAppConfig.findOne({ order: [['id', 'DESC']] });
  settingsCache = mergeSettings(
    row
      ? {
          appId: row.appId,
          appSecret: decryptSecret(row.appSecretEncrypted),
          configId: row.configId || '',
          graphVersion: row.graphVersion || envSettings().graphVersion,
        }
      : null,
  );
  return settingsCache;
}

export async function saveMetaSettings({ appId, appSecret, configId }) {
  await ensureTable();
  const current = await loadMetaSettings();
  const next = {
    appId: String(appId || '').trim() || current.appId,
    appSecret: String(appSecret || '').trim() || current.appSecret,
    configId: String(configId || '').trim() || current.configId || '',
    graphVersion: current.graphVersion || envSettings().graphVersion,
  };

  const existing = await MetaAppConfig.findOne({ order: [['id', 'DESC']] });
  const payload = {
    appId: next.appId,
    appSecretEncrypted: encryptSecret(next.appSecret),
    configId: next.configId || null,
    graphVersion: next.graphVersion,
  };

  if (existing) {
    await existing.update(payload);
  } else {
    await MetaAppConfig.create(payload);
  }

  process.env.FACEBOOK_APP_ID = next.appId;
  process.env.FACEBOOK_APP_SECRET = next.appSecret;
  if (next.configId) {
    process.env.FACEBOOK_CONFIG_ID = next.configId;
  }

  settingsCache = next;
  return {
    appId: next.appId,
    configId: next.configId || null,
    graphVersion: next.graphVersion,
  };
}
