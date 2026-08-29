import nodemailer from 'nodemailer';

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES) || 5;

function accountVerificationTemplate({ firstName, otp }) {
  return `
<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your Enquiry System account</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.07);">
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 28px;color:#ffffff;">
              <h1 style="margin:0;font-size:22px;font-weight:700;">Enquiry System Account Verification</h1>
              <p style="margin:8px 0 0;font-size:14px;opacity:.95;">Use this one-time code to verify your email address.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:15px;">Hi ${firstName || 'there'},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.65;">
                Thanks for using Enquiry System. Enter the OTP below to complete your email verification.
              </p>
              <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;">
                <div style="font-size:13px;color:#64748b;letter-spacing:.06em;text-transform:uppercase;">Your OTP code</div>
                <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#0f172a;margin-top:8px;">${otp}</div>
                <div style="font-size:12px;color:#64748b;margin-top:10px;">Valid for ${OTP_EXPIRY_MINUTES} minutes</div>
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
                If you did not sign up for Enquiry System, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function forgotPasswordOtpTemplate({ firstName, otp }) {
  return `
<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Enquiry System password</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.07);">
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9,#2563eb);padding:24px 28px;color:#ffffff;">
              <h1 style="margin:0;font-size:22px;font-weight:700;">Enquiry System Password Reset</h1>
              <p style="margin:8px 0 0;font-size:14px;opacity:.95;">Use this one-time code to reset your password.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:15px;">Hi ${firstName || 'there'},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.65;">
                We received a request to reset your Enquiry System account password. Enter this OTP to continue.
              </p>
              <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;">
                <div style="font-size:13px;color:#64748b;letter-spacing:.06em;text-transform:uppercase;">Password reset OTP</div>
                <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#0f172a;margin-top:8px;">${otp}</div>
                <div style="font-size:12px;color:#64748b;margin-top:10px;">Valid for ${OTP_EXPIRY_MINUTES} minutes</div>
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
                If you did not request a password reset, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function mailUser() {
  return String(process.env.MAIL_USER || '').trim();
}

function mailPassword() {
  return String(process.env.MAIL_APP_PASSWORD || process.env.MAIL_PASSWORD || '').replace(/\s+/g, '');
}

function createTransporter() {
  const user = mailUser();
  const pass = mailPassword();
  const host = (process.env.MAIL_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.MAIL_PORT) || 465;
  const secure =
    process.env.MAIL_SECURE != null
      ? String(process.env.MAIL_SECURE).toLowerCase() === 'true'
      : port === 465;

  if (host.includes('gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function mailFrom() {
  return (process.env.MAIL_FROM || process.env.MAIL_USER || '').replace(/^"|"$/g, '');
}

function isRealEmail(value) {
  return typeof value === 'string' && value.includes('@') && !value.endsWith('@signup.local');
}

async function sendOtpMail(to, otp, { firstName, purpose } = {}) {
  if (!isRealEmail(to)) {
    return false;
  }

  if (!mailUser() || !mailPassword()) {
    throw new Error('Mail credentials are not configured');
  }

  const isReset = purpose === 'reset';
  const html = isReset
    ? forgotPasswordOtpTemplate({ firstName, otp })
    : accountVerificationTemplate({ firstName, otp });

  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: mailFrom() || mailUser(),
      to,
      subject: isReset
        ? `Your Enquiry System password reset OTP is ${otp}`
        : `Your Enquiry System OTP is ${otp}`,
      text: `Hi ${firstName || 'there'}, your OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`,
      html,
    });
    console.log(`OTP email sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`OTP email failed for ${to}:`, error.message);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Unable to send OTP email. Please try again');
    }
    return false;
  }
}

async function sendMail({ to, subject, text, html }) {
  if (!isRealEmail(to)) {
    return false;
  }
  if (!mailUser() || !mailPassword()) {
    throw new Error('Mail credentials are not configured');
  }

  const transporter = createTransporter();
  try {
    await transporter.sendMail({
      from: mailFrom() || mailUser(),
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error(`Email failed for ${to}:`, error.message);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Unable to send email. Please try again');
    }
    return false;
  }
}

function inviteTemplate({ companyName, inviteUrl, role }) {
  return `
<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 28px;color:#ffffff;">
              <h1 style="margin:0;font-size:22px;">You're invited to Enquiry System</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:15px;">You have been invited to join <strong>${companyName}</strong> as <strong>${role.replaceAll('_', ' ')}</strong>.</p>
              <p style="margin:0 0 20px;font-size:15px;">Open the link below to accept the invite and verify your email.</p>
              <p style="margin:0;"><a href="${inviteUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;">Accept invite</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendInviteMail(to, { companyName, inviteUrl, role }) {
  return sendMail({
    to,
    subject: `Invite to ${companyName} on Enquiry System`,
    text: `You are invited to join ${companyName} as ${role}. Accept: ${inviteUrl}`,
    html: inviteTemplate({ companyName, inviteUrl, role }),
  });
}

export {
  accountVerificationTemplate,
  forgotPasswordOtpTemplate,
  sendOtpMail,
  sendInviteMail,
};
