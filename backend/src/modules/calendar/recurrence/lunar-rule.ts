// Deliberate copy of frontend/src/core/recurrence/lunar-rule.ts (ARC-02); change both sides together.
import { lunarMonthLength, lunarToSolar, solarToLunar } from '../lunar/lunar';
import { addDays, parseLocalDate, type LocalDate } from '../../../common/time/local-date';
import type { LunarRule } from './types';

export interface LunarHit {
  date: LocalDate;
  shortMonth: boolean;
}

export function validateLunarRule(rule: LunarRule): void {
  if (!Number.isInteger(rule.day) || rule.day < 1 || rule.day > 30) throw new RangeError('lunarRule.day must be 1..30');
  if (rule.freq === 'YEARLY' && (!Number.isInteger(rule.month) || rule.month! < 1 || rule.month! > 12)) {
    throw new RangeError('lunarRule.month must be 1..12 for YEARLY');
  }
}

/** Solar dates in [from, to] produced by the rule, ignoring series start/until. */
export function lunarRuleDates(rule: LunarRule, from: LocalDate, to: LocalDate): LunarHit[] {
  validateLunarRule(rule);
  const hits: LunarHit[] = [];
  if (rule.freq === 'YEARLY') {
    // Lunar months 11/12 of year Y can fall in January/February of solar year Y+1.
    for (let y = parseLocalDate(from).year - 1; y <= parseLocalDate(to).year; y++) {
      const len = lunarMonthLength(y, rule.month!, false);
      if (len === 0) continue;
      const day = Math.min(rule.day, len);
      const date = lunarToSolar({ day, month: rule.month!, year: y, leap: false });
      if (date && date >= from && date <= to) hits.push({ date, shortMonth: day < rule.day });
    }
    return hits;
  }
  let monthStart = addDays(from, -(solarToLunar(from).day - 1));
  while (monthStart <= to) {
    const info = solarToLunar(monthStart);
    const len = lunarMonthLength(info.year, info.month, info.leap);
    if (!info.leap || rule.includeLeap) {
      const day = Math.min(rule.day, len);
      const date = addDays(monthStart, day - 1);
      if (date >= from && date <= to) hits.push({ date, shortMonth: day < rule.day });
    }
    monthStart = addDays(monthStart, len);
  }
  return hits;
}
