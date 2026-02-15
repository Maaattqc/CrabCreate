import crypto from 'crypto';
import config from '../config';
import logger from './logger';

const ENC_PREFIX = 'enc:v1:';
const AUTH_CODE_HASH_PREFIX = 'h1:';

function keyMaterial(): Buffer {
  const source = process.env.SECRETS_ENCRYPTION_KEY || config.jwtSecret;
  if (!source || source === 'dev-secret-change-me-in-production') {
    if (config.nodeEnv === 'production') {
      throw new Error('SECRETS_ENCRYPTION_KEY or a strong JWT_SECRET is required in production');
    }
  }
  return crypto.createHash('sha256').update(source || 'dev-secret-change-me-in-production').digest();
}

function timingSafeStringEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

export function encryptSecret(value: string | null | undefined): string {
  if (!value) return '';
  if (isEncryptedSecret(value)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(value: string | null | undefined): string {
  if (!value) return '';
  if (!isEncryptedSecret(value)) return value;

  try {
    const payload = value.slice(ENC_PREFIX.length);
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) return '';

    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyMaterial(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function hashAuthCode(code: string): string {
  const digest = crypto.createHmac('sha256', keyMaterial()).update(code).digest('hex');
  return `${AUTH_CODE_HASH_PREFIX}${digest}`;
}

export function isHashedAuthCode(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(AUTH_CODE_HASH_PREFIX);
}

export function authCodeMatches(storedCode: string, candidate: string): boolean {
  if (!storedCode || !candidate) return false;

  if (isHashedAuthCode(storedCode)) {
    return timingSafeStringEquals(storedCode, hashAuthCode(candidate));
  }

  // Backward compatibility: old plaintext codes still verify.
  return timingSafeStringEquals(storedCode, candidate);
}
