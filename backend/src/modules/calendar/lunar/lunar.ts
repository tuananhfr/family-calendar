// Vietnamese lunar calendar, Hồ Ngọc Đức's algorithm (astronomical new moons per Meeus).
// Deliberate copy of frontend/src/core/lunar/lunar.ts (ARC-02): keep both identical and run both fixture suites.
import { formatLocalDate, parseLocalDate, type LocalDate } from '../../../common/time/local-date';

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  leap: boolean;
}

// Vietnam uses the 105°E meridian (UTC+7); Chinese tables use UTC+8, which moves Tết in years like 1985 and 2007.
const TIME_ZONE = 7;
const SYNODIC_MONTH = 29.530588853;
const NEW_MOON_EPOCH = 2415021.076998695;

// Gregorian-only Julian day number: the app never handles dates before 1582, so the Julian-calendar branch of
// the original algorithm is dropped to keep 'YYYY-MM-DD' strings proleptic Gregorian everywhere.
function jdFromDate(day: number, month: number, year: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdToDate(jd: number): LocalDate {
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((b * 146097) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = b * 100 + d - 4800 + Math.floor(m / 10);
  return formatLocalDate(year, month, day);
}

function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + C1 - deltat;
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return L;
}

/** Sun longitude sector (0..11, 30° each) at local midnight starting `dayNumber`. */
function sunLongitudeSector(dayNumber: number): number {
  return Math.floor((sunLongitude(dayNumber - 0.5 - TIME_ZONE / 24) / Math.PI) * 6);
}

function newMoonDay(k: number): number {
  return Math.floor(newMoon(k) + 0.5 + TIME_ZONE / 24);
}

const month11Cache = new Map<number, number>();

/** Day number of the start of lunar month 11 (the month containing the winter solstice) of `year`. */
function lunarMonth11(year: number): number {
  const cached = month11Cache.get(year);
  if (cached !== undefined) return cached;
  const off = jdFromDate(31, 12, year) - 2415021;
  const k = Math.floor(off / SYNODIC_MONTH);
  let nm = newMoonDay(k);
  if (sunLongitudeSector(nm) >= 9) nm = newMoonDay(k - 1);
  month11Cache.set(year, nm);
  return nm;
}

const leapOffsetCache = new Map<number, number>();

/** Offset (from month 11) of the first month without a major solar term — the leap month. */
function leapMonthOffset(a11: number): number {
  const cached = leapOffsetCache.get(a11);
  if (cached !== undefined) return cached;
  const k = Math.floor((a11 - NEW_MOON_EPOCH) / SYNODIC_MONTH + 0.5);
  let i = 1;
  let arc = sunLongitudeSector(newMoonDay(k + i));
  let last: number;
  do {
    last = arc;
    i++;
    arc = sunLongitudeSector(newMoonDay(k + i));
  } while (arc !== last && i < 14);
  leapOffsetCache.set(a11, i - 1);
  return i - 1;
}

export function solarToLunar(d: LocalDate): LunarDate {
  const { year: yy, month: mm, day: dd } = parseLocalDate(d);
  const dayNumber = jdFromDate(dd, mm, yy);
  // The original only steps back once from k+1; a true new moon far from the mean (e.g. around 2054-05-07)
  // then yields lunar day 0, so search both ways until monthStart <= dayNumber < next new moon.
  let k = Math.floor((dayNumber - NEW_MOON_EPOCH) / SYNODIC_MONTH) + 1;
  while (newMoonDay(k) > dayNumber) k--;
  while (newMoonDay(k + 1) <= dayNumber) k++;
  const monthStart = newMoonDay(k);
  let a11 = lunarMonth11(yy);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = lunarMonth11(yy - 1);
  } else {
    lunarYear = yy + 1;
    b11 = lunarMonth11(yy + 1);
  }
  const day = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let leap = false;
  let month = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11);
    if (diff >= leapDiff) {
      month = diff + 10;
      if (diff === leapDiff) leap = true;
    }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) lunarYear -= 1;
  return { day, month, year: lunarYear, leap };
}

/** Day number of lunar day 1 of the given month, or null when that (leap) month doesn't exist. */
function monthStartDay(year: number, month: number, leap: boolean): number | null {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) return null;
  let a11: number;
  let b11: number;
  if (month < 11) {
    a11 = lunarMonth11(year - 1);
    b11 = lunarMonth11(year);
  } else {
    a11 = lunarMonth11(year);
    b11 = lunarMonth11(year + 1);
  }
  const k = Math.floor(0.5 + (a11 - NEW_MOON_EPOCH) / SYNODIC_MONTH);
  let off = month - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && month !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) {
    return null;
  }
  return newMoonDay(k + off);
}

/** Days in a lunar month (29 "tháng thiếu" or 30 "tháng đủ"), 0 when the month doesn't exist that year. */
export function lunarMonthLength(year: number, month: number, leap: boolean): 0 | 29 | 30 {
  const start = monthStartDay(year, month, leap);
  if (start === null) return 0;
  // The next new moon is 29 or 30 days later; day +29 is either still this month (day 30) or the next month's 1st.
  const probe = solarToLunar(jdToDate(start + 29));
  return probe.day === 30 ? 30 : 29;
}

export function lunarToSolar(l: LunarDate): LocalDate | null {
  if (!Number.isInteger(l.day) || l.day < 1 || l.day > 30) return null;
  const start = monthStartDay(l.year, l.month, l.leap);
  if (start === null) return null;
  if (l.day === 30 && lunarMonthLength(l.year, l.month, l.leap) !== 30) return null;
  return jdToDate(start + l.day - 1);
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

export function canChiYear(year: number): string {
  return `${CAN[(((year + 6) % 10) + 10) % 10]} ${CHI[(((year + 8) % 12) + 12) % 12]}`;
}

export function formatLunar(l: LunarDate): string {
  return `${l.day} tháng ${l.month}${l.leap ? ' nhuận' : ''} (Âm lịch)`;
}
