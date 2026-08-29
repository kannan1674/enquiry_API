import { graphConfigured, metaSettings } from './metaSettings.js';

function graphVersion() {
  const raw = String(
    metaSettings().graphVersion || process.env.META_GRAPH_VERSION || 'v21.0',
  ).trim();
  const match = raw.match(/v\d+\.\d+/i);
  return match ? match[0] : 'v21.0';
}

function graphBase() {
  return `https://graph.facebook.com/${graphVersion()}`;
}

export function callbackUrl() {
  const explicit = String(process.env.META_REDIRECT_URI || '').trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const base = (
    process.env.BACKEND_PUBLIC_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    || `http://127.0.0.1:${process.env.PORT || 8000}`
  ).replace(/\/$/, '');

  return `${base}/api/meta/callback`;
}

async function graphGet(path, token, params = {}) {
  const url = new URL(`${graphBase()}${path.startsWith('/') ? path : `/${path}`}`);
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
    nextPath = parsed.pathname.replace(`/${graphVersion()}`, '') || parsed.pathname;
    nextParams = Object.fromEntries(parsed.searchParams.entries());
    delete nextParams.access_token;
  }

  return items;
}

export async function exchangeJsSdkCode(code) {
  const url = new URL(`${graphBase()}/oauth/access_token`);
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

export async function exchangeCodeForToken(code) {
  const url = new URL(`${graphBase()}/oauth/access_token`);
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

export async function exchangeLongLivedToken(shortToken) {
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

export async function discoverBusinessAssets(accessToken) {
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
    wabas.push(
      ...owned.map((item) => ({ ...item, metaBusinessId: business.id })),
      ...clientOwned.map((item) => ({ ...item, metaBusinessId: business.id })),
    );
  }

  const uniqueWabas = [...new Map(wabas.map((item) => [item.id, item])).values()];
  for (const waba of uniqueWabas) {
    const numbers = await graphGetAll(`/${waba.id}/phone_numbers`, accessToken, {
      fields: 'id,display_phone_number,verified_name,quality_rating',
    }).catch(() => []);
    const businessId = waba.metaBusinessId || businesses[0]?.id || null;
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
          metaBusinessId: businessId,
        },
      });
    });
  }

  return {
    facebookUserId: String(profile.id),
    facebookName: profile.name || null,
    assets,
  };
}

export async function subscribeWabaWebhook(wabaId, accessToken) {
  if (!wabaId || !accessToken) {
    return false;
  }

  const url = new URL(`${graphBase()}/${wabaId}/subscribed_apps`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    console.error('WABA webhook subscribe failed:', data.error?.message || response.status);
    return false;
  }
  return true;
}

export function buildAuthUrl(state) {
  const settings = metaSettings();
  const url = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
  url.searchParams.set('client_id', settings.appId);
  url.searchParams.set('redirect_uri', callbackUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  if (settings.configId) {
    url.searchParams.set('config_id', settings.configId);
    url.searchParams.set('override_default_response_type', 'true');
  } else {
    url.searchParams.set(
      'scope',
      [
        'business_management',
        'whatsapp_business_management',
        'whatsapp_business_messaging',
        'ads_read',
      ].join(','),
    );
  }

  return url.toString();
}

function fromMinorUnits(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  return Number((raw / 100).toFixed(2));
}

function daysInclusive(since, until) {
  if (!since || !until) {
    return 1;
  }
  const start = new Date(`${since}T00:00:00+05:30`);
  const end = new Date(`${until}T00:00:00+05:30`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

export async function fetchConnectedAds(accessToken, { since, until } = {}) {
  if (!accessToken) {
    return [];
  }

  const accounts = await graphGetAll('/me/adaccounts', accessToken, {
    fields: 'id,account_id,name,currency,account_status',
  }).catch(() => []);

  const ads = [];
  for (const account of accounts) {
    const actId = account.id || (account.account_id ? `act_${account.account_id}` : null);
    if (!actId) {
      continue;
    }

    const rows = await graphGetAll(`/${actId}/ads`, accessToken, {
      fields: [
        'id,name,effective_status,created_time',
        'campaign{id,name,daily_budget,lifetime_budget}',
        'adset{id,name,daily_budget,lifetime_budget}',
      ].join(','),
      limit: 200,
    }).catch(() => []);

    for (const ad of rows) {
      const dailyBudget = fromMinorUnits(ad.adset?.daily_budget || ad.campaign?.daily_budget);
      const lifetimeBudget = fromMinorUnits(ad.adset?.lifetime_budget || ad.campaign?.lifetime_budget);
      ads.push({
        adId: String(ad.id),
        adName: ad.name || null,
        campaignId: ad.campaign?.id || null,
        campaignName: ad.campaign?.name || null,
        amount: lifetimeBudget || Number((dailyBudget * daysInclusive(since, until)).toFixed(2)),
        amountType: lifetimeBudget ? 'lifetime' : dailyBudget ? 'daily' : null,
        dailyBudget,
        lifetimeBudget,
        currency: account.currency || 'INR',
        status: ad.effective_status || null,
        accountId: String(account.account_id || account.id),
      });
    }
  }

  return ads;
}

export async function fetchAdInsights(adId, accessToken, { since, until } = {}) {
  if (!adId || !accessToken) {
    return null;
  }

  const ad = await graphGet(`/${adId}`, accessToken, {
    fields: [
      'id,name,account_id',
      'campaign{id,name,daily_budget,lifetime_budget}',
      'adset{id,name,daily_budget,lifetime_budget,budget_remaining}',
    ].join(','),
  }).catch(() => null);

  if (!ad) {
    return null;
  }

  const dailyBudget = fromMinorUnits(ad.adset?.daily_budget || ad.campaign?.daily_budget);
  const lifetimeBudget = fromMinorUnits(ad.adset?.lifetime_budget || ad.campaign?.lifetime_budget);
  const amountType = lifetimeBudget ? 'lifetime' : dailyBudget ? 'daily' : null;
  const amount = lifetimeBudget || Number((dailyBudget * daysInclusive(since, until)).toFixed(2));

  return {
    adId: String(adId),
    adName: ad.name || null,
    campaignId: ad.campaign?.id || null,
    campaignName: ad.campaign?.name || null,
    amount,
    amountType,
    dailyBudget,
    lifetimeBudget,
    currency: 'INR',
  };
}

export { graphConfigured };
