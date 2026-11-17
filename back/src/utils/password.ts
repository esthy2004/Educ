import crypto from 'node:crypto';
import type { UserAccount } from '../types';

const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';
const CURRENT_PREFIX = 'pbkdf2b';

function derive(password: string, salt: Buffer, iterations: number): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = derive(password, salt, ITERATIONS).toString('hex');
  return `${CURRENT_PREFIX}$${ITERATIONS}$${salt.toString('hex')}$${hash}`;
}

export function isPasswordHash(value: string): boolean {
  return /^(pbkdf2b?)\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(value);
}

export function isLegacyPasswordHash(value: string): boolean {
  return /^pbkdf2\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(value);
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!isPasswordHash(stored)) return stored === password;
  const [prefix, iterationsValue, salt, expectedHex] = stored.split('$');
  const iterations = Number(iterationsValue);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  // Les empreintes historiques utilisaient la chaîne hexadécimale comme sel UTF-8.
  const saltBytes = prefix === CURRENT_PREFIX ? Buffer.from(salt, 'hex') : Buffer.from(salt, 'utf8');
  const actual = derive(password, saltBytes, iterations);
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/** Convertit les anciens mots de passe en clair en empreintes PBKDF2. */
export function migratePasswordHashes(db: { users: UserAccount[] }): boolean {
  let changed = false;
  for (const user of db.users) {
    if (user.password && !isPasswordHash(user.password)) {
      user.password = hashPassword(user.password);
      changed = true;
    }
  }
  return changed;
}
