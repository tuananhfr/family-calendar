import type { CalendarSystem } from "@/core/model/common";
import { solarToLunar } from "@/core/lunar/lunar";
import { parseRrule } from "@/core/recurrence/expand";
import { toFloating } from "@/core/recurrence/floating";
import type { LunarRule, Schedule } from "@/core/recurrence/types";
import { dayOfWeek, parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";

export const REPEAT_KINDS = [
  "NONE",
  "DAILY",
  "WEEKDAYS",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
  "LUNAR_YEARLY",
  "LUNAR_MONTHLY",
  "CUSTOM",
] as const;
export type RepeatKind = (typeof REPEAT_KINDS)[number];

export type RepeatPreset = {
  kind: RepeatKind;
  rrule?: string;
  byDay?: string[];
  /** LUNAR_MONTHLY: also repeat in leap months. */
  includeLeap?: boolean;
  /** Lunar series end (set when a series was split); solar series keep UNTIL inside a CUSTOM rrule. */
  lunarUntil?: LocalDate;
};

/** RRULE weekday codes indexed like dayOfWeek (0 = Sunday). */
export const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];
const MONDAY_FIRST: readonly WeekdayCode[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const WEEKDAYS_RULE = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";

export interface RepeatRule {
  calendarSystem: CalendarSystem;
  rrule?: string;
  lunarRule?: LunarRule;
}

function normalizeByDay(byDay: string[] | undefined, startDate: LocalDate): WeekdayCode[] {
  const days = byDay && byDay.length > 0 ? byDay.map((d) => d.toUpperCase()) : [WEEKDAY_CODES[dayOfWeek(startDate)]];
  for (const d of days) if (!(WEEKDAY_CODES as readonly string[]).includes(d)) throw new RangeError(`Unknown weekday: ${d}`);
  return MONDAY_FIRST.filter((d) => days.includes(d));
}

function withUntil(rule: LunarRule, repeat: RepeatPreset): LunarRule {
  return repeat.lunarUntil ? { ...rule, until: repeat.lunarUntil } : rule;
}

/**
 * Turns the repeat picker value into schedule fields. Lunar repetition only exists yearly/monthly (modules.md §5),
 * so LUNAR + YEARLY/MONTHLY means the lunar variant and LUNAR with any other repeat stays solar.
 */
export function repeatToRule(repeat: RepeatPreset, start: LocalDate, calendarSystem: CalendarSystem = "SOLAR"): RepeatRule {
  const date = datePart(start);
  let kind = repeat.kind;
  if (calendarSystem === "LUNAR" && kind === "YEARLY") kind = "LUNAR_YEARLY";
  if (calendarSystem === "LUNAR" && kind === "MONTHLY") kind = "LUNAR_MONTHLY";
  const { month, day } = parseLocalDate(date);
  switch (kind) {
    case "NONE":
      return { calendarSystem: "SOLAR" };
    case "DAILY":
      return { calendarSystem: "SOLAR", rrule: "FREQ=DAILY" };
    case "WEEKDAYS":
      return { calendarSystem: "SOLAR", rrule: WEEKDAYS_RULE };
    case "WEEKLY":
      return { calendarSystem: "SOLAR", rrule: `FREQ=WEEKLY;BYDAY=${normalizeByDay(repeat.byDay, date).join(",")}` };
    case "MONTHLY":
      // RRULE skips months without this day (31 → no February); that is the spec'd behaviour.
      return { calendarSystem: "SOLAR", rrule: `FREQ=MONTHLY;BYMONTHDAY=${day}` };
    case "YEARLY":
      return { calendarSystem: "SOLAR", rrule: `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${day}` };
    case "LUNAR_YEARLY": {
      const l = solarToLunar(date);
      return { calendarSystem: "LUNAR", lunarRule: withUntil({ freq: "YEARLY", day: l.day, month: l.month, includeLeap: false }, repeat) };
    }
    case "LUNAR_MONTHLY": {
      const rule: LunarRule = { freq: "MONTHLY", day: solarToLunar(date).day, includeLeap: repeat.includeLeap ?? false };
      return { calendarSystem: "LUNAR", lunarRule: withUntil(rule, repeat) };
    }
    case "CUSTOM": {
      const body = repeat.rrule?.trim().replace(/^RRULE:/i, "");
      if (!body) throw new RangeError("Custom repeat needs an RRULE");
      try {
        parseRrule(body, toFloating(date));
      } catch {
        throw new RangeError(`Invalid RRULE: ${body}`);
      }
      return { calendarSystem: "SOLAR", rrule: body };
    }
  }
}

function parts(rrule: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of rrule.replace(/^RRULE:/i, "").split(";")) {
    const eq = p.indexOf("=");
    if (eq > 0) map.set(p.slice(0, eq).toUpperCase(), p.slice(eq + 1).toUpperCase());
  }
  return map;
}

/** Best-effort inverse of repeatToRule for edit forms; anything else (INTERVAL, UNTIL…) stays CUSTOM. */
export function repeatFromSchedule(schedule: Pick<Schedule, "start"> & Partial<Schedule>): RepeatPreset {
  if (schedule.lunarRule) {
    const r = schedule.lunarRule;
    const out: RepeatPreset = { kind: r.freq === "YEARLY" ? "LUNAR_YEARLY" : "LUNAR_MONTHLY" };
    if (r.freq === "MONTHLY" && r.includeLeap) out.includeLeap = true;
    if (r.until) out.lunarUntil = r.until;
    return out;
  }
  if (!schedule.rrule) return { kind: "NONE" };
  const p = parts(schedule.rrule);
  const keys = [...p.keys()].sort().join(",");
  const { month, day } = parseLocalDate(datePart(schedule.start));
  const freq = p.get("FREQ");
  if (keys === "FREQ" && freq === "DAILY") return { kind: "DAILY" };
  if (keys === "BYDAY,FREQ" && freq === "WEEKLY") {
    const days = p.get("BYDAY")!.split(",");
    if (days.join(",") === "MO,TU,WE,TH,FR") return { kind: "WEEKDAYS" };
    if (days.every((d) => (WEEKDAY_CODES as readonly string[]).includes(d))) return { kind: "WEEKLY", byDay: days };
  }
  if (keys === "BYMONTHDAY,FREQ" && freq === "MONTHLY" && p.get("BYMONTHDAY") === String(day)) return { kind: "MONTHLY" };
  if (keys === "BYMONTH,BYMONTHDAY,FREQ" && freq === "YEARLY" && p.get("BYMONTH") === String(month) && p.get("BYMONTHDAY") === String(day)) {
    return { kind: "YEARLY" };
  }
  return { kind: "CUSTOM", rrule: schedule.rrule };
}
