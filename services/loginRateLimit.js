import { LoginAttempt } from '../models/index.js';

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_MS = 60 * 1000;

let tableReady = false;

async function ensureTable() {
  if (tableReady) {
    return;
  }
  await LoginAttempt.sync();
  tableReady = true;
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function remainingSeconds(blockedUntil) {
  return Math.max(1, Math.ceil((new Date(blockedUntil).getTime() - Date.now()) / 1000));
}

function blockedError(blockedUntil) {
  const retryAfter = remainingSeconds(blockedUntil);
  return Object.assign(
    new Error(`Too many failed login attempts. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}`),
    {
      status: 429,
      retryAfter,
      blockedUntil,
    },
  );
}

async function getRow(ipAddress) {
  await ensureTable();
  const [row] = await LoginAttempt.findOrCreate({
    where: { ipAddress },
    defaults: { ipAddress, failedCount: 0, blockedUntil: null },
  });
  return row;
}

export async function assertLoginAllowed(ipAddress) {
  const row = await getRow(ipAddress);
  if (row.blockedUntil && new Date(row.blockedUntil).getTime() > Date.now()) {
    throw blockedError(row.blockedUntil);
  }

  if (row.blockedUntil) {
    await row.update({ failedCount: 0, blockedUntil: null });
  }
}

export async function recordLoginFailure(ipAddress) {
  const row = await getRow(ipAddress);
  if (row.blockedUntil && new Date(row.blockedUntil).getTime() > Date.now()) {
    throw blockedError(row.blockedUntil);
  }

  const failedCount = Number(row.failedCount || 0) + 1;
  const blockedUntil = failedCount >= MAX_FAILED_ATTEMPTS
    ? new Date(Date.now() + BLOCK_MS)
    : null;

  await row.update({
    failedCount: blockedUntil ? 0 : failedCount,
    blockedUntil,
  });

  if (blockedUntil) {
    throw blockedError(blockedUntil);
  }

  return {
    remainingAttempts: MAX_FAILED_ATTEMPTS - failedCount,
  };
}

export async function recordLoginSuccess(ipAddress) {
  const row = await getRow(ipAddress);
  if (row.failedCount || row.blockedUntil) {
    await row.update({ failedCount: 0, blockedUntil: null });
  }
}
