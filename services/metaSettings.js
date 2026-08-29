const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'config', 'meta-app.json');

function readStoredSettings() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) || {};
  } catch {
    return {};
  }
}

function metaSettings() {
  const stored = readStoredSettings();
  return {
    appId: process.env.FACEBOOK_APP_ID || stored.appId || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || stored.appSecret || '',
    configId: process.env.FACEBOOK_CONFIG_ID || stored.configId || '',
    graphVersion: process.env.FACEBOOK_GRAPH_VERSION || stored.graphVersion || 'v21.0',
  };
}

function graphConfigured() {
  const settings = metaSettings();
  return Boolean(settings.appId && settings.appSecret);
}

function saveMetaSettings({ appId, appSecret, configId }) {
  const current = readStoredSettings();
  const next = {
    ...current,
    appId: String(appId || '').trim() || current.appId || '',
    appSecret: String(appSecret || '').trim() || current.appSecret || '',
    configId: String(configId || '').trim() || current.configId || '',
  };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  process.env.FACEBOOK_APP_ID = next.appId;
  process.env.FACEBOOK_APP_SECRET = next.appSecret;
  if (next.configId) {
    process.env.FACEBOOK_CONFIG_ID = next.configId;
  }
  return next;
}

module.exports = {
  metaSettings,
  graphConfigured,
  saveMetaSettings,
};
