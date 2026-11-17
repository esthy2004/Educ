const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const CURRENT_PREFIX = 'pbkdf2b';

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    KEY_LENGTH * 8,
  );
  return bytesToHex(new Uint8Array(bits));
}

export function isPasswordHash(value: string): boolean {
  return /^(pbkdf2b?)\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(value);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `${CURRENT_PREFIX}$${ITERATIONS}$${bytesToHex(salt)}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!isPasswordHash(stored)) return stored === password;
  const [prefix, iterationsValue, salt, expected] = stored.split('$');
  const iterations = Number(iterationsValue);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const saltBytes = prefix === CURRENT_PREFIX ? hexToBytes(salt) : new TextEncoder().encode(salt);
  const actual = await derive(password, saltBytes, iterations);
  return actual === expected;
}
