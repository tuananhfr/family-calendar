import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256-bit opaque credential, base64url (43 chars). */
export function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Constant-time string comparison; empty values never match. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
