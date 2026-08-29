import { metaSettings, graphConfigured } from './metaSettings.js';

function graphVersion() {
  return metaSettings().graphVersion || 'v21.0';
}

const GRAPH_VERSION = graphVersion();
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function callbackUrl() {
  const base = (process.env.BACKEND_PUBLIC_URL || `http://127.0.0.1:${process.env.PORT || 8000}`).replace(
    /\/$/,
    '',
  );
  return `${base}/api/meta/callback`;
}

async function graphGet(path, token, params = {}) {
  const url = new URL(`${GRAPH_BASE}${path.startsWith('/') ? path : `/${path}`}`);
  url.searchParams.set('access_token', token);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Graph API request failed (${response.status})`);
  }
  return data;
}

async function graphGetAll(path, token, params = {}) {
  const items = [];
  let nextPath = path;
  let nextParams = { ...params };

  while (nextPath) {
    const page = await graphGet(nextPath, token, nextParams);
    items.push(...(page.data || []));
    const nextUrl = page.paging?.next;
    if (!nextUrl) {
      break;
    }
    const parsed = new URL(nextUrl);
    nextPath = parsed.pathname.replace(`/${GRAPH_VERSION}`, '') || parsed.pathname;
    nextParams = Object.fromEntries(parsed.searchParams.entries());
    delete nextParams.access_token;
  }

  return items;
}

async function exchangeJsSdkCode(code) {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set('client_id', metaSettings().appId);
  url.searchParams.set('client_secret', metaSettings().appSecret);
  url.searchParams.set('code', code);

  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(data.error?.message || 'Facebook token exchange failed');
  }
  return data;
}

async function exchangeCodeForToken(code) {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set('client_id', metaSettings().appId);
  url.searchParams.set('client_secret', metaSettings().appSecret);
  url.searchParams.set('redirect_uri', callbackUrl());
  url.searchParams.set('code', code);

  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(data.error?.message || 'Facebook token exchange failed');
  }
  return data;
}

async function exchangeLongLivedToken(shortToken) {
  try {
    const data = await graphGet('/oauth/access_token', shortToken, {
      grant_type: 'fb_exchange_token',
      client_id: metaSettings().appId,
      client_secret: metaSettings().appSecret,
      fb_exchange_token: shortToken,
    });
    return data.access_token || shortToken;
  } catch {
    return shortToken;
  }
}

async function discoverBusinessAssets(accessToken) {
  const profile = await graphGet('/me', accessToken, { fields: 'id,name' });
  const assets = [];

  const businesses = await graphGetAll('/me/businesses', accessToken, { fields: 'id,name' }).catch(() => []);
  const assignedWabas = await graphGetAll('/me/assigned_whatsapp_business_accounts', accessToken, {
    fields: 'id,name',
  }).catch(() => []);
  const wabas = [...assignedWabas];

  for (const business of businesses) {
    const owned = await graphGetAll(`/${business.id}/owned_whatsapp_business_accounts`, accessToken, {
      fields: 'id,name',
    }).catch(() => []);
    const clientOwned = await graphGetAll(`/${business.id}/client_whatsapp_business_accounts`, accessToken, {
      fields: 'id,name',
    }).catch(() => []);
    wabas.push(...owned, ...clientOwned);
  }

  const uniqueWabas = [...new Map(wabas.map((item) => [item.id, item])).values()];
  for (const waba of uniqueWabas) {
    const numbers = await graphGetAll(`/${waba.id}/phone_numbers`, accessToken, {
      fields: 'id,display_phone_number,verified_name,quality_rating',
    }).catch(() => []);
    numbers.forEach((number) => {
      assets.push({
        channelType: 'whatsapp',
        externalId: String(number.id),
        displayName: number.verified_name || number.display_phone_number || String(number.id),
        metadata: {
          source: 'facebook_login',
          displayPhoneNumber: number.display_phone_number || null,
          wabaId: waba.id,
          wabaName: waba.name || null,
        },
      });
    });
  }

  const pages = await graphGetAll('/me/accounts', accessToken, {
    fields: 'id,name,instagram_business_account',
  }).catch(() => []);

  for (const page of pages) {
    assets.push({
      channelType: 'facebook_page',
      externalId: String(page.id),
      displayName: page.name || String(page.id),
      metadata: { source: 'facebook_login' },
    });

    const igId = page.instagram_business_account?.id;
    if (igId) {
      assets.push({
        channelType: 'instagram',
        externalId: String(igId),
        displayName: `${page.name || 'Instagram'} Instagram`,
        metadata: { source: 'facebook_login', pageId: page.id },
      });
    }
  }

  return {
    facebookUserId: String(profile.id),
    facebookName: profile.name || null,
    assets,
  };
}

function buildAuthUrl(state) {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', metaSettings().appId);
  url.searchParams.set('redirect_uri', callbackUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  if (metaSettings().configId) {
    url.searchParams.set('config_id', metaSettings().configId);
    url.searchParams.set('override_default_response_type', 'true');
  } else {
    url.searchParams.set(
      'scope',
      [
        'business_management',
        'whatsapp_business_management',
        'whatsapp_business_messaging',
        'pages_show_list',
        'pages_read_engagement',
        'instagram_basic',
      ].join(','),
    );
  }

  return url.toString();
}

export {
  graphConfigured,
  callbackUrl,
  exchangeCodeForToken,
  exchangeJsSdkCode,
  exchangeLongLivedToken,
  discoverBusinessAssets,
  buildAuthUrl,
};
