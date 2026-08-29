export function allowedVerifyTokens() {
  return new Set(
    [
      process.env.META_VERIFY_TOKEN,
      process.env.WHATSAPP_VERIFY_TOKEN,
      'enquiry_system_whatsapp_verify_2026',
      'enquiry-meta-verify',
    ].filter(Boolean),
  );
}

export function isValidVerifyToken(token) {
  return Boolean(token) && allowedVerifyTokens().has(String(token));
}

export function handleMetaVerify({ mode, token, challenge }) {
  if (mode === 'subscribe' && isValidVerifyToken(token) && challenge != null) {
    return { ok: true, challenge: String(challenge) };
  }
  return { ok: false };
}
