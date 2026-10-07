/** Calendar date 'YYYY-MM-DD' with no time zone; all arithmetic here is pure integer math, never Date. */
export type LocalDate = string;

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  const m = LOCAL_DATE.exec(value);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(Number(m[1]), month);
}

export function parseLocalDate(d: LocalDate): DateParts {
  if (!isLocalDate(d)) throw new RangeError(`Invalid LocalDate: ${d}`);
  return { year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)), day: Number(d.slice(8, 10)) };
}

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Howard Hinnant's days_from_civil / civil_from_days (proleptic Gregorian), epoch 1970-01-01 = 0.
export function toEpochDay(d: LocalDate): number {
  const { year, month, day } = parseLocalDate(d);
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromEpochDay(n: number): LocalDate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return formatLocalDate(year, month, day);
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromEpochDay(toEpochDay(d) + n);
}

/** Number of days from `a` to `b` (positive when b is later). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return toEpochDay(b) - toEpochDay(a);
}

/** 0 = Sunday … 6 = Saturday, matching Date#getDay and RRULE weekday order used in the UI. */
export function dayOfWeek(d: LocalDate): number {
  return (((toEpochDay(d) + 4) % 7) + 7) % 7;
}

export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Monday of the week containing `d` when weekStartsOn = 1, Sunday when 0. */
export function startOfWeek(d: LocalDate, weekStartsOn: 0 | 1 = 1): LocalDate {
  const shift = (dayOfWeek(d) - weekStartsOn + 7) % 7;
  return addDays(d, -shift);
}

export function startOfMonth(d: LocalDate): LocalDate {
  return `${d.slice(0, 8)}01`;
}

export function endOfMonth(d: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(d);
  return formatLocalDate(year, month, daysInMonth(year, month));
}
