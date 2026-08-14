import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const newId = (): string => randomUUID();
export const newSessionToken = (): string => randomBytes(32).toString('base64url');
export const newDiscriminator = (): string => randomBytes(2).toString('hex').toUpperCase();

export function newRecoveryCode(): string {
  const raw = randomBytes(12).toString('hex').toUpperCase();
  return `CB-${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}-${raw.slice(18)}`;
}

export function normalizeRecoveryCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function hashSecret(value: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createAdminToken(adminName: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ sub: adminName, exp: now + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

export function verifyAdminToken(token: string, secret: string, now = Date.now()): string | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: string; exp?: number };
    return value.sub && value.exp && value.exp > now ? value.sub : null;
  } catch { return null; }
}
