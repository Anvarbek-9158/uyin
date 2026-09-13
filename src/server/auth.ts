import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PASSWORD_MIN_LENGTH, UserRecord } from '../types.js';

// ============================================================
// Real account authentication (email + password).
//
// Passwords are never stored or transmitted as plaintext. Each password is
// hashed with scrypt (Node's built-in KDF, no native/optional dependency) using
// a fresh random 16-byte salt; comparison is constant-time so a timing side
// channel cannot recover the hash or the password.
//
// The stored format is `scrypt$<saltHex>:<hashHex>` (64-byte derived key).
// ============================================================

export { PASSWORD_MIN_LENGTH };

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const marker = 'scrypt$';
  if (!stored.startsWith(marker)) return false;
  const rest = stored.slice(marker.length);
  const sep = rest.indexOf(':');
  if (sep <= 0) return false;
  const saltHex = rest.slice(0, sep);
  const hashHex = rest.slice(sep + 1);
  if (saltHex.length === 0 || hashHex.length === 0) return false;
  try {
    const candidate = scryptSync(password, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN);
    const expected = Buffer.from(hashHex, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

// Public-safe projection: never send the hash to the browser. Legacy account
// records (created before plans existed) lack a `plan`; they are 'free'.
export function publicUser(user: UserRecord): Omit<UserRecord, 'passwordHash'> {
  const { passwordHash: _hash, ...rest } = user;
  return { ...rest, plan: user.plan === 'pro' ? 'pro' : 'free' };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Auth session tokens: same unguessable 64-char lowercase hex format as the
// per-game client session tokens, so they are stored/compared identically.
export function mintAuthToken(): string {
  return randomBytes(32).toString('hex');
}