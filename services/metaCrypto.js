import crypto from 'crypto';

function encryptionKey() {
  const secret = process.env.META_ENCRYPT_KEY || process.env.JWT_SECRET || 'enquiry-meta-key';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(value) {
  const plain = String(value || '');
  if (!plain) {
    return '';
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(value) {
  const stored = String(value || '');
  if (!stored) {
    return '';
  }
  if (!stored.startsWith('enc:')) {
    return stored;
  }

  const [, ivHex, tagHex, dataHex] = stored.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
