import { createHash } from 'node:crypto';
import { Matches } from 'class-validator';

/**
 * Canonical client-generated UUID (lowercase, RFC 4122 variant). Uppercase variants are rejected
 * because id columns compare byte-exact and would otherwise allow two spellings of one id.
 */
export const CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isClientId(value: unknown): value is string {
  return typeof value === 'string' && CLIENT_ID_PATTERN.test(value);
}

export function IsClientId(): PropertyDecorator {
  return Matches(CLIENT_ID_PATTERN, { message: '$property must be a lowercase UUID' });
}

/**
 * Same inputs, same id (RFC 9562 version 8 layout), so a retried worker step writes the same row instead of a
 * second one; still matches CLIENT_ID_PATTERN so clients can send it back.
 */
export function deterministicId(...parts: string[]): string {
  const h = createHash('sha256').update(parts.join('|')).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
