import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Otp, Tenant, PipelineStage } from '../models/index.js';
import { sendOtpMail } from '../Email_Template/template.js';
import { slugifyClientCode, seedDefaultPipeline } from '../services/tenantSetup.js';
import { loadAuthorisedClientIds } from '../middleware/auth.js';

const PASSWORD_RULE_MESSAGE =
  'Password must be 8–128 characters and include uppercase, lowercase, a number, and a special character.';

function isStrongPassword(password) {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

const OTP_LENGTH = Number(process.env.OTP_LENGTH) || 6;
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES) || 5;
const OTP_MAX_VERIFY_ATTEMPTS = Number(process.env.OTP_MAX_VERIFY_ATTEMPTS) || 5;

function generateOtp() {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH;
  return String(crypto.randomInt(min, max));
}

function signToken(user, authorisedClientIds) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      authorisedClientIds,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );
}

export function normalizeIdentifier(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : '';

  if (email) {
    return { channel: 'email', destination: email, field: 'email' };
  }
  if (mobile) {
    return { channel: 'mobile', destination: mobile, field: 'mobile' };
  }
  return null;
}

function otpResponse(channel, message = 'OTP sent') {
  return {
    success: true,
    message,
    channel,
    expiresInMinutes: OTP_EXPIRY_MINUTES,
  };
}

async function findUser(identifier) {
  return User.findOne({
    where: { [identifier.field]: identifier.destination },
  });
}

async function getAuthorisedClientIds(user) {
  return loadAuthorisedClientIds(user);
}

export async function issueOtp(user, identifier, purpose = 'verify') {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.update(
    { verifiedAt: new Date() },
    {
      where: {
        userId: user.id,
        verifiedAt: null,
      },
    },
  );

  await Otp.create({
    userId: user.id,
    otpHash,
    channel: identifier.channel,
    destination: identifier.destination,
    expiresAt,
  });

  const mailTo = identifier.channel === 'email' ? identifier.destination : user.email;

  try {
    const mailed = await sendOtpMail(mailTo, otp, { firstName: user.name, purpose });
    if (mailed) {
      console.log(`OTP emailed to ${mailTo}`);
    } else {
      console.log(`OTP generated for ${mailTo} (email not delivered)`);
    }
  } catch (error) {
    console.error('OTP email error:', error.message);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    console.log(`OTP generated for ${mailTo} (email not delivered)`);
  }

  return otp;
}

async function consumeOtp(user, otp) {
  const otpRecord = await Otp.findOne({
    where: {
      userId: user.id,
      verifiedAt: null,
    },
    order: [['id', 'DESC']],
  });

  if (!otpRecord) {
    return { error: { status: 401, message: 'Invalid OTP' } };
  }

  if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
    return { error: { status: 401, message: 'OTP expired' } };
  }

  if (otpRecord.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    await user.update({ status: 'locked' });
    return { error: { status: 403, message: 'Too many invalid attempts. Account is locked' } };
  }

  const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
  if (!isMatch) {
    await otpRecord.increment('attempts');
    await user.increment('failedAttempts');
    return { error: { status: 401, message: 'Invalid OTP' } };
  }

  await otpRecord.update({
    verifiedAt: new Date(),
    attempts: otpRecord.attempts + 1,
  });

  return { otpRecord };
}

export async function buildAuthResponse(user, message = 'Login successful') {
  await user.update({
    status: 'active',
    lastLogin: new Date(),
    failedAttempts: 0,
  });

  const authorisedClientIds = await getAuthorisedClientIds(user);
  const token = signToken(user, authorisedClientIds);

  return {
    success: true,
    message,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      tenantId: user.tenantId,
      authorisedClientIds,
    },
  };
}

export async function signup(req, res, next) {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const mobile = typeof req.body?.mobile === 'string' ? req.body.mobile.trim() : '';
    const companyName = typeof req.body?.companyName === 'string' ? req.body.companyName.trim() : '';
    const accountKind = req.body?.accountKind === 'agency' ? 'agency' : 'direct';
    const tenantId = req.body?.tenantId ? Number(req.body.tenantId) : null;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    if (!email && !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Email or mobile is required',
      });
    }

    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }
    }

    if (mobile) {
      const existingMobile = await User.findOne({ where: { mobile } });
      if (existingMobile) {
        return res.status(409).json({ success: false, message: 'Mobile already registered' });
      }
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ success: false, message: PASSWORD_RULE_MESSAGE });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    if (accountKind === 'direct' && !companyName) {
      return res.status(400).json({ success: false, message: 'Business name is required' });
    }

    if (tenantId) {
      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant || tenant.status !== 'active') {
        return res.status(400).json({ success: false, message: 'Invalid tenant' });
      }
    }

    let workspaceTenantId = tenantId;
    let role = tenantId ? 'client_executive' : accountKind === 'agency' ? 'agency_super_admin' : 'direct_owner';

    if (accountKind === 'direct' && !tenantId) {
      const tenant = await Tenant.create({
        companyName,
        clientCode: slugifyClientCode(companyName),
        timezone: 'Asia/Kolkata',
        status: 'active',
        accountType: 'direct',
      });
      await seedDefaultPipeline(tenant.id, PipelineStage);
      workspaceTenantId = tenant.id;
      role = 'direct_owner';
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email || `${mobile}@signup.local`,
      mobile: mobile || null,
      tenantId: workspaceTenantId,
      role,
      passwordHash,
      status: 'inactive',
    });

    if (accountKind === 'direct' && workspaceTenantId) {
      await Tenant.update({ ownerUserId: user.id }, { where: { id: workspaceTenantId } });
    }

    const identifier = email
      ? { channel: 'email', destination: email, field: 'email' }
      : { channel: 'mobile', destination: mobile, field: 'mobile' };

    await issueOtp(user, identifier, 'verify');

    return res.status(201).json({
      ...otpResponse(identifier.channel, 'Account created. Verification OTP sent'),
      needsVerification: true,
      email: user.email.endsWith('@signup.local') ? null : user.email,
    });
  } catch (error) {
    return next(error);
  }
}

export async function signin(req, res, next) {
  try {
    const identifier = normalizeIdentifier(req.body || {});
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
      });
    }

    const user = await findUser(identifier);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please signup',
      });
    }

    if (user.status === 'locked') {
      return res.status(403).json({
        success: false,
        message: 'Account is locked',
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        success: false,
        message: 'No password is set for this account. Use Forgot password to create one',
      });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      await user.increment('failedAttempts');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (user.status === 'inactive') {
      await issueOtp(user, identifier, 'verify');
      return res.status(403).json({
        success: false,
        message: 'Account not verified. Verification OTP sent',
        needsVerification: true,
        channel: identifier.channel,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      });
    }

    return res.json(await buildAuthResponse(user));
  } catch (error) {
    return next(error);
  }
}

export async function sendOtp(req, res, next) {
  return signin(req, res, next);
}

export async function resendOtp(req, res, next) {
  try {
    const identifier = normalizeIdentifier(req.body || {});
    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Email or mobile is required',
      });
    }

    const user = await findUser(identifier);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.status === 'locked') {
      return res.status(403).json({
        success: false,
        message: 'Account is locked',
      });
    }

    const purpose = req.body?.purpose === 'reset' ? 'reset' : 'verify';
    await issueOtp(user, identifier, purpose);

    return res.json(otpResponse(identifier.channel, 'OTP resent'));
  } catch (error) {
    return next(error);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const identifier = normalizeIdentifier(req.body || {});
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';

    if (!identifier || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email or mobile, and OTP are required',
      });
    }

    const user = await findUser(identifier);

    if (!user || user.status === 'locked') {
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    const result = await consumeOtp(user, otp);
    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    return res.json(await buildAuthResponse(user));
  } catch (error) {
    return next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const identifier = normalizeIdentifier(req.body || {});
    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Email or mobile is required',
      });
    }

    const user = await findUser(identifier);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.status === 'locked') {
      return res.status(403).json({
        success: false,
        message: 'Account is locked',
      });
    }

    await issueOtp(user, identifier, 'reset');
    return res.json(otpResponse(identifier.channel, 'Reset OTP sent'));
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const identifier = normalizeIdentifier(req.body || {});
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const confirmPassword =
      typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

    if (!identifier || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email or mobile, and OTP are required',
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_RULE_MESSAGE,
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    const user = await findUser(identifier);
    if (!user || user.status === 'locked') {
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    const result = await consumeOtp(user, otp);
    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await user.update({ passwordHash });

    return res.json(await buildAuthResponse(user, 'Password reset successful'));
  } catch (error) {
    return next(error);
  }
}
