const crypto = require('crypto');
const { Op } = require('sequelize');
const { UserInvite, Tenant, User } = require('../models');
const { sendInviteMail } = require('../Email_Template/template');
const bcrypt = require('bcryptjs');
const { buildAuthResponse } = require('./authController');
const { CLIENT_ROLES } = require('../middleware/auth');

const INVITE_DAYS = 7;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function inviteUrl(token) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/invite/${token}`;
}

function serializeInvite(invite) {
  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt,
  };
}

async function listInvites(req, res, next) {
  try {
    const invites = await UserInvite.findAll({
      where: { tenantId: req.tenantId },
      order: [['id', 'DESC']],
    });
    return res.json({ success: true, invites: invites.map(serializeInvite) });
  } catch (error) {
    return next(error);
  }
}

async function createInvite(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const role = CLIENT_ROLES.includes(req.body?.role) ? req.body.role : 'client_executive';

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser && existingUser.tenantId && Number(existingUser.tenantId) !== Number(req.tenantId)) {
      return res.status(409).json({ success: false, message: 'Email already belongs to another client' });
    }

    await UserInvite.update(
      { expiresAt: new Date() },
      {
        where: {
          tenantId: req.tenantId,
          email,
          acceptedAt: null,
          expiresAt: { [Op.gt]: new Date() },
        },
      },
    );

    const token = crypto.randomBytes(24).toString('hex');
    const invite = await UserInvite.create({
      tenantId: req.tenantId,
      email,
      name: name || null,
      role,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      invitedBy: req.user.id,
    });

    const tenant = await Tenant.findByPk(req.tenantId);
    const url = inviteUrl(token);
    const mailed = await sendInviteMail(email, {
      companyName: tenant.companyName,
      inviteUrl: url,
      role,
    });

    return res.status(201).json({
      success: true,
      message: mailed ? 'Invite sent' : 'Invite created. Email was not delivered',
      invite: serializeInvite(invite),
    });
  } catch (error) {
    return next(error);
  }
}

async function getInvite(req, res, next) {
  try {
    const token = String(req.params.token || '');
    const invite = await UserInvite.findOne({
      where: { tokenHash: hashToken(token) },
      include: [{ model: Tenant, attributes: ['id', 'companyName', 'clientCode'] }],
    });

    if (!invite || invite.acceptedAt || new Date(invite.expiresAt).getTime() < Date.now()) {
      return res.status(404).json({ success: false, message: 'Invite is invalid or expired' });
    }

    return res.json({
      success: true,
      invite: {
        email: invite.email,
        name: invite.name,
        role: invite.role,
        companyName: invite.Tenant?.companyName,
        clientCode: invite.Tenant?.clientCode,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function acceptInvite(req, res, next) {
  try {
    const token = String(req.params.token || '');
    const invite = await UserInvite.findOne({
      where: { tokenHash: hashToken(token) },
    });

    if (!invite || invite.acceptedAt || new Date(invite.expiresAt).getTime() < Date.now()) {
      return res.status(404).json({ success: false, message: 'Invite is invalid or expired' });
    }

    const name =
      typeof req.body?.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : invite.name;
    const mobile = typeof req.body?.mobile === 'string' ? req.body.mobile.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Password must be 8–128 characters and include uppercase, lowercase, a number, and a special character.',
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    let user = await User.findOne({ where: { email: invite.email } });
    if (user && user.tenantId && Number(user.tenantId) !== Number(invite.tenantId)) {
      return res.status(409).json({ success: false, message: 'Email already belongs to another client' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (!user) {
      user = await User.create({
        name,
        email: invite.email,
        mobile: mobile || null,
        tenantId: invite.tenantId,
        role: invite.role,
        passwordHash,
        status: 'active',
      });
    } else {
      await user.update({
        name,
        mobile: mobile || user.mobile,
        tenantId: invite.tenantId,
        role: invite.role,
        passwordHash,
        status: 'active',
      });
    }

    await invite.update({ acceptedAt: new Date() });

    return res.json(await buildAuthResponse(user, 'Invite accepted'));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listInvites,
  createInvite,
  getInvite,
  acceptInvite,
};
