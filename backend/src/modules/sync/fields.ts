import { isLocalDate } from '../../common/time/local-date';
import { isLocalDateTime, isValidTimeZone } from '../../common/time/zoned';
import { CLIENT_ID_PATTERN } from '../../common/ids';

// Wire ⇄ column codecs used by every registry definition. Error values are stable codes (REQUIRED, TOO_LONG…)
// that the client maps to Vietnamese text, mirroring the frontend zod messages.

export const INVALID = Symbol('invalid');
export type Parsed<T> = T | typeof INVALID;

export class FieldErrors {
  readonly map: Record<string, string> = {};

  add(path: string, code: string): typeof INVALID {
    if (!(path in this.map)) this.map[path] = code;
    return INVALID;
  }

  get empty(): boolean {
    return Object.keys(this.map).length === 0;
  }
}

export interface Codec<T = unknown> {
  /** Wire value (never undefined) → value bound into SQL. */
  parse(value: unknown, path: string, errors: FieldErrors): Parsed<T>;
  /** Raw value read from MariaDB → wire value. */
  out(raw: unknown): unknown;
}

const MAX_MONEY = 999_999_999_999_999n;

function identity(raw: unknown): unknown {
  return raw;
}

export function parseJsonColumn(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Trimmed text; `min` 1 means required non-empty (frontend requiredText), 0 allows ''. */
export function text(max: number, min = 1): Codec<string> {
  return {
    parse(v, path, e) {
      if (typeof v !== 'string') return e.add(path, 'INVALID');
      const s = v.trim();
      if (s.length < min) return e.add(path, 'REQUIRED');
      if ([...s].length > max) return e.add(path, 'TOO_LONG');
      return s;
    },
    out: identity,
  };
}

/** Untrimmed token-like string (keys, sound names). */
export function plain(max: number, min = 0, pattern?: RegExp): Codec<string> {
  return {
    parse(v, path, e) {
      if (typeof v !== 'string') return e.add(path, 'INVALID');
      if (v.length < min) return e.add(path, 'REQUIRED');
      if (v.length > max) return e.add(path, 'TOO_LONG');
      if (pattern && !pattern.test(v)) return e.add(path, 'INVALID');
      return v;
    },
    out: identity,
  };
}

export function oneOf<T extends string>(values: readonly T[]): Codec<T> {
  return {
    parse(v, path, e) {
      return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : e.add(path, 'INVALID');
    },
    out: identity,
  };
}

export function int(min: number, max: number): Codec<number> {
  return {
    parse(v, path, e) {
      if (typeof v !== 'number' || !Number.isInteger(v)) return e.add(path, 'INVALID');
      if (v < min || v > max) return e.add(path, 'OUT_OF_RANGE');
      return v;
    },
    out: (raw) => (raw === null ? null : Number(raw)),
  };
}

/** Finite number stored in a DECIMAL column with `scale` digits; more precision than that is rejected. */
export function decimal(min: number, max: number, scale: number): Codec<string> {
  return {
    parse(v, path, e) {
      if (typeof v !== 'number' || !Number.isFinite(v)) return e.add(path, 'INVALID');
      if (v < min || v > max) return e.add(path, 'OUT_OF_RANGE');
      const factor = 10 ** scale;
      if (Math.abs(Math.round(v * factor) - v * factor) > 1e-6) return e.add(path, 'TOO_PRECISE');
      return v.toFixed(scale);
    },
    out: (raw) => (raw === null ? null : Number(raw)),
  };
}

export const bool: Codec<number> = {
  parse(v, path, e) {
    return typeof v === 'boolean' ? (v ? 1 : 0) : e.add(path, 'INVALID');
  },
  out: (raw) => (raw === null ? null : Boolean(Number(raw))),
};

/**
 * Integer VND. Accepts a JSON number (what the frontend sends) or a digit string; always answered as a string
 * so no client has to trust float precision (Global Constraints: "chuỗi ở API").
 */
export function money(opts: { positive: boolean }): Codec<string> {
  return {
    parse(v, path, e) {
      let n: bigint;
      if (typeof v === 'number' && Number.isSafeInteger(v)) n = BigInt(v);
      else if (typeof v === 'string' && /^\d{1,15}$/.test(v)) n = BigInt(v);
      else return e.add(path, 'AMOUNT_INVALID');
      if (n < 0n) return e.add(path, 'AMOUNT_NEGATIVE');
      if (n > MAX_MONEY) return e.add(path, 'AMOUNT_TOO_LARGE');
      if (opts.positive && n === 0n) return e.add(path, 'AMOUNT_NOT_POSITIVE');
      return n.toString();
    },
    out: (raw) => (raw === null ? null : String(raw)),
  };
}

export const localDate: Codec<string> = {
  parse(v, path, e) {
    return isLocalDate(v) ? v : e.add(path, 'INVALID_DATE');
  },
  out: identity,
};

export const localDateTime: Codec<string> = {
  parse(v, path, e) {
    return isLocalDateTime(v) ? v : e.add(path, 'INVALID_DATETIME');
  },
  out: identity,
};

export const yearMonth: Codec<string> = {
  parse(v, path, e) {
    return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : e.add(path, 'INVALID_MONTH');
  },
  out: identity,
};

export const timeZone: Codec<string> = {
  parse(v, path, e) {
    return typeof v === 'string' && v.length <= 64 && isValidTimeZone(v) ? v : e.add(path, 'INVALID_TIME_ZONE');
  },
  out: identity,
};

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** ISO-8601 instant with offset → UTC Date; answered as `toISOString()`. */
export const instant: Codec<Date> = {
  parse(v, path, e) {
    if (typeof v !== 'string' || !ISO_INSTANT.test(v)) return e.add(path, 'INVALID_TIMESTAMP');
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? e.add(path, 'INVALID_TIMESTAMP') : d;
  },
  out: (raw) => (raw === null ? null : new Date(raw as string | Date).toISOString()),
};

export const id: Codec<string> = {
  parse(v, path, e) {
    return typeof v === 'string' && CLIENT_ID_PATTERN.test(v) ? v : e.add(path, 'INVALID_ID');
  },
  out: identity,
};

/** Array stored as a JSON column. */
export function jsonArray<T>(item: Codec<T>, opts: { max: number; unique?: boolean; min?: number }): Codec<string> {
  return {
    parse(v, path, e) {
      const values = parseArray(item, v, path, e, opts);
      return values === INVALID ? INVALID : JSON.stringify(values);
    },
    out: (raw) => parseJsonColumn(raw) ?? [],
  };
}

/** Parses an array value element by element; shared by JSON columns and child tables. */
export function parseArray<T>(
  item: Codec<T>,
  v: unknown,
  path: string,
  e: FieldErrors,
  opts: { max: number; unique?: boolean; min?: number },
): Parsed<T[]> {
  if (!Array.isArray(v)) return e.add(path, 'INVALID');
  if (v.length > opts.max) return e.add(path, 'TOO_MANY');
  if (v.length < (opts.min ?? 0)) return e.add(path, 'REQUIRED');
  const out: T[] = [];
  let failed = false;
  v.forEach((el: unknown, i) => {
    const parsed = item.parse(el, `${path}.${i}`, e);
    if (parsed === INVALID) failed = true;
    else out.push(parsed);
  });
  if (failed) return INVALID;
  if (opts.unique && new Set(out.map((x) => JSON.stringify(x))).size !== out.length) return e.add(path, 'DUPLICATE');
  return out;
}

/** JSON object column validated by a custom function that returns the value to store (or INVALID). */
export function jsonObject(validate: (v: unknown, path: string, e: FieldErrors) => Parsed<unknown>): Codec<string> {
  return {
    parse(v, path, e) {
      const parsed = validate(v, path, e);
      return parsed === INVALID ? INVALID : JSON.stringify(parsed);
    },
    out: (raw) => parseJsonColumn(raw),
  };
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
