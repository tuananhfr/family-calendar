// Keys whose values may carry family content or credentials; matched case-insensitively at any depth.
const REDACTED_KEYS = new Set([
  'title',
  'note',
  'body',
  'description',
  'amount',
  'token',
  'code',
  'latitude',
  'longitude',
  'payload',
]);

const MARK = '[REDACTED]';

/**
 * Copy of `value` that is safe to log (PRV-001). Errors keep only their name: driver and library messages often
 * echo the data that caused them.
 */
export function redact(value: unknown): unknown {
  return walk(value, new WeakSet());
}

function walk(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name };
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => walk(v, seen));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.has(key.toLowerCase()) ? MARK : walk(v, seen);
  }
  return out;
}
