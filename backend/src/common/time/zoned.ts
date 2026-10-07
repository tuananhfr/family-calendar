// Deliberate copy of frontend/src/core/time/zoned.ts (ARC-02); change both sides together.
import { isLocalDate, type LocalDate } from './local-date';

/** Wall-clock time 'YYYY-MM-DDTHH:mm' interpreted in an IANA zone stored next to it. */
export type LocalDateTime = string;

const DAY_MS = 86_400_000;
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

export function isLocalDateTime(value: unknown): value is LocalDateTime {
  if (typeof value !== 'string') return false;
  const m = LOCAL_DATE_TIME.exec(value);
  return !!m && isLocalDate(m[1]);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallParts(instantMs: number, timeZone: string): WallParts {
  const out: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return { year: out.year, month: out.month, day: out.day, hour: out.hour, minute: out.minute, second: out.second };
}

/** UTC offset of `timeZone` at `instant`, in minutes (Asia/Ho_Chi_Minh → 420). */
export function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  return offsetMs(instant.getTime(), timeZone) / 60000;
}

function offsetMs(instantMs: number, timeZone: string): number {
  const flooredMs = Math.floor(instantMs / 1000) * 1000;
  const p = wallParts(flooredMs, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - flooredMs;
}

export function instantToZoned(instant: Date, timeZone: string): LocalDateTime {
  const p = wallParts(instant.getTime(), timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(p.year).padStart(4, '0')}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Instant at which the wall clock in `timeZone` shows `local`.
 * DST gap (time doesn't exist) → shifted forward by the gap; overlap (time occurs twice) → earlier instant.
 */
export function zonedToInstant(local: LocalDateTime, timeZone: string): Date {
  if (!isLocalDateTime(local)) throw new RangeError(`Invalid LocalDateTime: ${local}`);
  const wallAsUtc = Date.UTC(
    Number(local.slice(0, 4)),
    Number(local.slice(5, 7)) - 1,
    Number(local.slice(8, 10)),
    Number(local.slice(11, 13)),
    Number(local.slice(14, 16)),
  );
  // Zones change offset at most once within a day, so the offsets a day before/after are the only candidates.
  const before = offsetMs(wallAsUtc - DAY_MS, timeZone);
  const after = offsetMs(wallAsUtc + DAY_MS, timeZone);
  const valid = [wallAsUtc - before, wallAsUtc - after].filter((t) => offsetMs(t, timeZone) === wallAsUtc - t);
  if (valid.length > 0) return new Date(Math.min(...valid));
  return new Date(wallAsUtc - before);
}

export function todayIn(timeZone: string, now: Date = new Date()): LocalDate {
  return instantToZoned(now, timeZone).slice(0, 10);
}

export function datePart(value: LocalDate | LocalDateTime): LocalDate {
  return value.slice(0, 10);
}

/** 'HH:mm' of a LocalDateTime, or null for an all-day LocalDate. */
export function timePart(value: LocalDate | LocalDateTime): string | null {
  return value.length > 10 ? value.slice(11, 16) : null;
}
