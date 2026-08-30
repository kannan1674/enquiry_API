import crypto from 'crypto';
import { RefreshToken, User } from '../models/index.js';

const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

let tableReady = false;

export function parseDurationMs(value, fallbackMs) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) {
    return fallbackMs;
  }
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (multipliers[unit] || 1000);
}

export function accessExpiresIn() {
  return ACCESS_EXPIRES_IN;
}

export function accessExpiresInSeconds() {
  return Math.max(30, Math.round(parseDurationMs(ACCESS_EXPIRES_IN, 15 * 60 * 1000) / 1000));
}

export function accessExpiresAtIso() {
  return new Date(Date.now() + accessExpiresInSeconds() * 1000).toISOString();
}

function refreshExpiresAt() {
  return new Date(Date.now() + parseDurationMs(REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000));
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

async function ensureTable() {
  if (tableReady) {
    return;
  }
  await RefreshToken.sync();
  tableReady = true;
}

export async function issueRefreshToken(userId) {
  await ensureTable();
  const raw = crypto.randomBytes(48).toString('hex');
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: refreshExpiresAt(),
  });
  return raw;
}

export async function rotateRefreshToken(current) {
  await ensureTable();
  const raw = crypto.randomBytes(48).toString('hex');
  const created = await RefreshToken.create({
    userId: current.userId,
    tokenHash: hashToken(raw),
    expiresAt: refreshExpiresAt(),
  });
  await current.update({
    revokedAt: new Date(),
    replacedByTokenId: created.id,
  });
  return raw;
}

export async function findRefreshToken(raw) {
  await ensureTable();
  if (!raw) {
    return null;
  }
  return RefreshToken.findOne({
    where: { tokenHash: hashToken(raw) },
  });
}

export async function revokeRefreshToken(raw) {
  const record = await findRefreshToken(raw);
  if (!record || record.revokedAt) {
    return false;
  }
  await record.update({ revokedAt: new Date() });
  return true;
}

export async function revokeAllUserRefreshTokens(userId) {
  await ensureTable();
  await RefreshToken.update(
    { revokedAt: new Date() },
    {
      where: {
        userId,
        revokedAt: null,
      },
    },
  );
}

export async function consumeRefreshToken(raw) {
  const record = await findRefreshToken(raw);
  if (!record) {
    return { error: { status: 401, message: 'Invalid refresh token' } };
  }

  if (record.revokedAt) {
    await revokeAllUserRefreshTokens(record.userId);
    return { error: { status: 401, message: 'Refresh token is no longer valid' } };
  }

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await record.update({ revokedAt: new Date() });
    return { error: { status: 401, message: 'Refresh token expired' } };
  }

  const user = await User.findByPk(record.userId);
  if (!user || user.status === 'locked') {
    await record.update({ revokedAt: new Date() });
    return { error: { status: 401, message: 'Invalid refresh token' } };
  }

  const refreshToken = await rotateRefreshToken(record);
  return { user, refreshToken };
}
