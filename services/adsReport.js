import { Op } from 'sequelize';
import { Ad, InboundMessage, UserMetaConnection, User } from '../models/index.js';
import { loadAuthorisedClientIds } from '../middleware/auth.js';
import { fetchAdInsights, fetchConnectedAds } from './metaGraph.js';
import { loadMetaSettings } from './metaSettings.js';

function parseDay(value, fallback) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function todayIst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function daysAgoIst(days) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60000);
  ist.setDate(ist.getDate() - days);
  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, '0');
  const day = String(ist.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function resolveDateRange(query = {}) {
  const endDate = parseDay(query.endDate || query.to, todayIst());
  const startDate = parseDay(query.startDate || query.from, daysAgoIst(29));
  if (startDate > endDate) {
    throw Object.assign(new Error('startDate must be before endDate'), { status: 400 });
  }

  return {
    startDate,
    endDate,
    startAt: new Date(`${startDate}T00:00:00+05:30`),
    endAt: new Date(`${endDate}T23:59:59.999+05:30`),
  };
}

export async function accessibleTenantIds(user) {
  if (user.role === 'agency_super_admin') {
    return null;
  }
  if (user.role === 'agency_manager' || user.role === 'agency_agent') {
    const fresh = await User.findByPk(user.id);
    return loadAuthorisedClientIds(fresh);
  }
  return user.tenantId ? [Number(user.tenantId)] : [];
}

async function findAccessToken(user, tenantId) {
  const where = { userId: user.id };
  if (tenantId) {
    const byTenant = await UserMetaConnection.findOne({
      where: { userId: user.id, tenantId },
      order: [['lastSyncedAt', 'DESC']],
    });
    if (byTenant?.accessToken) {
      return byTenant.accessToken;
    }
  }
  const latest = await UserMetaConnection.findOne({
    where,
    order: [['lastSyncedAt', 'DESC']],
  });
  return latest?.accessToken || null;
}

export async function buildAdsReport({ user, tenantId, adId, startDate, endDate }) {
  const range = resolveDateRange({ startDate, endDate });
  const allowedIds = await accessibleTenantIds(user);

  if (tenantId && allowedIds && !allowedIds.includes(Number(tenantId))) {
    throw Object.assign(new Error('Tenant access denied'), { status: 403 });
  }

  const localAds = await loadLocalAds({ tenantId, allowedIds, adId, range }).catch(() => []);
  const testAdIds = localAds
    .filter((ad) => ad.isTest)
    .map((ad) => String(ad.adId));

  const messageWhere = {
    receivedAt: {
      [Op.between]: [range.startAt, range.endAt],
    },
  };
  if (adId) {
    messageWhere.adId = String(adId);
  }

  const tenantOrTest = [];
  if (tenantId) {
    tenantOrTest.push({ tenantId: Number(tenantId) });
  } else if (allowedIds?.length) {
    tenantOrTest.push({ tenantId: allowedIds });
  }
  if (testAdIds.length) {
    tenantOrTest.push({ adId: testAdIds });
  }
  if (tenantOrTest.length && allowedIds !== null) {
    messageWhere[Op.or] = tenantOrTest;
  } else if (allowedIds && !allowedIds.length && !testAdIds.length) {
    return emptyReport(range);
  }

  const messages = await InboundMessage.findAll({
    where: messageWhere,
    order: [['receivedAt', 'ASC']],
  });

  const grouped = new Map();
  for (const row of messages) {
    const id = row.adId ? String(row.adId) : '';
    if (!id) {
      continue;
    }
    if (!grouped.has(id)) {
      grouped.set(id, {
        adId: id,
        campaignId: row.campaignId || null,
        queryCount: 0,
        customers: new Set(),
        firstQueryAt: row.receivedAt,
        lastQueryAt: row.receivedAt,
      });
    }
    const item = grouped.get(id);
    item.queryCount += 1;
    if (row.customerWaId || row.customerNumber) {
      item.customers.add(row.customerWaId || row.customerNumber);
    }
    if (row.campaignId && !item.campaignId) {
      item.campaignId = row.campaignId;
    }
    if (row.receivedAt < item.firstQueryAt) {
      item.firstQueryAt = row.receivedAt;
    }
    if (row.receivedAt > item.lastQueryAt) {
      item.lastQueryAt = row.receivedAt;
    }
  }

  await loadMetaSettings();
  const token = await findAccessToken(user, tenantId);
  const metaAds = token
    ? await fetchConnectedAds(token, {
        since: range.startDate,
        until: range.endDate,
      }).catch(() => [])
    : [];

  const adsById = new Map();
  for (const metaAd of [...localAds, ...metaAds]) {
    if (adId && String(metaAd.adId) !== String(adId)) {
      continue;
    }
    adsById.set(String(metaAd.adId), {
      adId: String(metaAd.adId),
      adName: metaAd.adName,
      campaignId: metaAd.campaignId,
      campaignName: metaAd.campaignName,
      queryCount: 0,
      uniqueCustomers: 0,
      amount: metaAd.amount ?? 0,
      amountType: metaAd.amountType || null,
      isTest: Boolean(metaAd.isTest),
      dailyBudget: metaAd.dailyBudget ?? 0,
      lifetimeBudget: metaAd.lifetimeBudget ?? 0,
      currency: metaAd.currency || 'INR',
      status: metaAd.status || null,
      firstQueryAt: null,
      lastQueryAt: null,
    });
  }

  for (const item of grouped.values()) {
    const existing = adsById.get(item.adId);
    if (existing) {
      existing.queryCount = item.queryCount;
      existing.uniqueCustomers = item.customers.size;
      existing.firstQueryAt = item.firstQueryAt;
      existing.lastQueryAt = item.lastQueryAt;
      if (!existing.campaignId) {
        existing.campaignId = item.campaignId;
      }
    } else {
      const insights = token
        ? await fetchAdInsights(item.adId, token, {
            since: range.startDate,
            until: range.endDate,
          }).catch(() => null)
        : null;
      adsById.set(item.adId, {
        adId: item.adId,
        adName: insights?.adName || null,
        campaignId: insights?.campaignId || item.campaignId || null,
        campaignName: insights?.campaignName || null,
        queryCount: item.queryCount,
        uniqueCustomers: item.customers.size,
        amount: insights?.amount ?? 0,
        amountType: insights?.amountType || null,
        dailyBudget: insights?.dailyBudget ?? 0,
        lifetimeBudget: insights?.lifetimeBudget ?? 0,
        currency: insights?.currency || 'INR',
        status: null,
        firstQueryAt: item.firstQueryAt,
        lastQueryAt: item.lastQueryAt,
      });
    }
  }

  const ads = [...adsById.values()];

  ads.sort((a, b) => b.queryCount - a.queryCount);

  const totalQueries = ads.reduce((sum, ad) => sum + ad.queryCount, 0);
  const totalAmount = ads.reduce((sum, ad) => sum + Number(ad.amount || 0), 0);

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    timezone: 'Asia/Kolkata',
    adsRun: ads.length,
    totalQueries,
    totalAmount: Number(totalAmount.toFixed(2)),
    currency: ads[0]?.currency || 'INR',
    ads,
  };
}

function daysInclusive(since, until) {
  const start = new Date(`${since}T00:00:00+05:30`);
  const end = new Date(`${until}T00:00:00+05:30`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

function runAmount(ad, range) {
  const lifetime = Number(ad.lifetimeBudget || 0);
  const daily = Number(ad.dailyBudget || 0);
  if (lifetime > 0) {
    return { amount: lifetime, amountType: 'lifetime' };
  }
  if (daily > 0) {
    return {
      amount: Number((daily * daysInclusive(range.startDate, range.endDate)).toFixed(2)),
      amountType: 'daily',
    };
  }
  return { amount: 0, amountType: null };
}

async function loadLocalAds({ tenantId, allowedIds, adId, range }) {
  await Ad.sync();

  const where = {};
  if (adId) {
    where.adId = String(adId);
  }

  // Seed/test ads are visible to every signed-in user.
  if (allowedIds !== null || tenantId) {
    const tenantFilter = [{ isTest: true }, { tenantId: null }];
    if (tenantId) {
      tenantFilter.push({ tenantId: Number(tenantId) });
    } else if (allowedIds?.length) {
      tenantFilter.push({ tenantId: allowedIds });
    }
    where[Op.or] = tenantFilter;
  }

  const rows = await Ad.findAll({ where, order: [['id', 'ASC']] });
  return rows.map((row) => {
    const { amount, amountType } = runAmount(row, range);
    return {
      adId: String(row.adId),
      adName: row.adName,
      campaignId: row.campaignId || null,
      campaignName: row.campaignName || null,
      amount,
      amountType,
      dailyBudget: Number(row.dailyBudget || 0),
      lifetimeBudget: Number(row.lifetimeBudget || 0),
      currency: row.currency || 'INR',
      status: row.status || 'ACTIVE',
      isTest: Boolean(row.isTest),
    };
  });
}

function emptyReport(range) {
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    timezone: 'Asia/Kolkata',
    adsRun: 0,
    totalQueries: 0,
    totalAmount: 0,
    currency: 'INR',
    ads: [],
  };
}
