import jwt from 'jsonwebtoken';
import { User, Tenant } from '../models/index.js';

const AGENCY_ROLES = ['agency_super_admin', 'agency_manager', 'agency_agent'];
const AGENCY_ADMIN_ROLES = ['agency_super_admin', 'agency_manager'];
const CLIENT_ROLES = ['client_admin', 'client_manager', 'client_executive'];
const PLATFORM_ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL || 'admin@enquiry.local';

async function loadUserRecord(user) {
  if (!user) {
    return null;
  }
  if (user.email && user.getAuthorisedClients) {
    return user;
  }
  return User.findByPk(user.id || user.userId);
}

function isPlatformAdmin(user) {
  return user?.role === 'agency_super_admin' && user?.email === PLATFORM_ADMIN_EMAIL;
}

async function loadAuthorisedClientIds(user) {
  if (!user) {
    return [];
  }

  if (user.role === 'agency_super_admin') {
    return [];
  }

  if (user.role === 'direct_owner' || CLIENT_ROLES.includes(user.role)) {
    return user.tenantId ? [Number(user.tenantId)] : [];
  }

  if (Array.isArray(user.authorisedClientIds) && user.authorisedClientIds.length) {
    return user.authorisedClientIds.map(Number);
  }

  const fresh = await loadUserRecord(user);
  if (!fresh) {
    return [];
  }

  if (fresh.role === 'direct_owner' || CLIENT_ROLES.includes(fresh.role)) {
    return fresh.tenantId ? [Number(fresh.tenantId)] : [];
  }

  if (AGENCY_ROLES.includes(fresh.role)) {
    const [owned, authorised] = await Promise.all([
      Tenant.findAll({
        where: { agencyOwnerUserId: fresh.id, status: 'active' },
        attributes: ['id'],
      }),
      typeof fresh.getAuthorisedClients === 'function'
        ? fresh.getAuthorisedClients({ attributes: ['id'] })
        : [],
    ]);
    return [...new Set([
      ...owned.map((tenant) => tenant.id),
      ...authorised.map((tenant) => tenant.id),
    ])];
  }

  return fresh.tenantId ? [Number(fresh.tenantId)] : [];
}

async function resolveAccessibleTenantIds(user) {
  if (!user) {
    return [];
  }
  if (user.role === 'agency_super_admin') {
    return null;
  }
  if (user.role === 'direct_owner' || CLIENT_ROLES.includes(user.role)) {
    return user.tenantId ? [Number(user.tenantId)] : [];
  }
  if (Array.isArray(user.authorisedClientIds) && user.authorisedClientIds.length) {
    return user.authorisedClientIds.map(Number);
  }
  return loadAuthorisedClientIds(user);
}

function canAccessTenant(user, tenantId) {
  const id = Number(tenantId);
  if (!id) {
    return false;
  }
  return (user.authorisedClientIds || []).includes(id);
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.userId,
      role: payload.role,
      tenantId: payload.tenantId || null,
      authorisedClientIds: Array.isArray(payload.authorisedClientIds)
        ? payload.authorisedClientIds.map(Number)
        : [],
    };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    return next();
  };
}

function requireTenantAccess(param = 'tenantId') {
  return async (req, res, next) => {
    const tenantId = Number(req.params[param] || req.body?.tenantId);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant is required' });
    }

    if (req.user.role === 'agency_super_admin') {
      req.tenantId = tenantId;
      return next();
    }

    if (Number(req.user.tenantId) === tenantId) {
      req.tenantId = tenantId;
      return next();
    }

    if ((req.user.authorisedClientIds || []).includes(tenantId)) {
      req.tenantId = tenantId;
      return next();
    }

    if (AGENCY_ROLES.includes(req.user.role) || req.user.role === 'direct_owner') {
      const ids = await loadAuthorisedClientIds(req.user);
      if (!ids.includes(tenantId)) {
        return res.status(403).json({ success: false, message: 'Tenant access denied' });
      }
      req.tenantId = tenantId;
      return next();
    }

    if (Number(req.user.tenantId) !== tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant access denied' });
    }

    req.tenantId = tenantId;
    return next();
  };
}

export {
  AGENCY_ROLES,
  AGENCY_ADMIN_ROLES,
  CLIENT_ROLES,
  PLATFORM_ADMIN_EMAIL,
  authenticate,
  requireRoles,
  requireTenantAccess,
  canAccessTenant,
  loadAuthorisedClientIds,
  resolveAccessibleTenantIds,
  isPlatformAdmin,
};
