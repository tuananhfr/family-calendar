import { RRule } from "rrule";
import { addDays, isLocalDate, type LocalDate } from "../time/local-date";
import { datePart, isLocalDateTime, type LocalDateTime } from "../time/zoned";
import { fromFloating, shiftWall, toFloating, wallDurationMinutes } from "./floating";
import { lunarRuleDates } from "./lunar-rule";
import { occurrenceKey, parseOccurrenceKey } from "./occurrence-key";
import type { DateWindow, ItemException, Occurrence, Schedule } from "./types";

export const DEFAULT_MAX_OCCURRENCES = 1000;

interface GeneratedStart {
  start: LocalDate | LocalDateTime;
  lunarShortMonth?: boolean;
}

function assertScheduleShape(schedule: Schedule): void {
  const ok = schedule.allDay ? isLocalDate : isLocalDateTime;
  if (!ok(schedule.start) || (schedule.end !== undefined && !ok(schedule.end))) {
    throw new RangeError(`Schedule start/end do not match allDay=${schedule.allDay}`);
  }
}

export function parseRrule(body: string, dtstart: Date): RRule {
  // DTSTART is owned by Schedule.start; a stray one in the body would silently override it.
  const cleaned = body
    .replace(/^RRULE:/i, "")
    .split(";")
    .filter((part) => part && !/^DTSTART/i.test(part))
    .join(";");
  const options = RRule.parseString(cleaned);
  if (options.freq === undefined || options.freq === null || Number.isNaN(options.freq)) {
    throw new RangeError(`Invalid RRULE: ${body}`);
  }
  return new RRule({ ...options, dtstart, tzid: null });
}

/** Original starts whose date lies in [from, to], in order, at most `maxCount`. */
function generateStarts(schedule: Schedule, from: LocalDate, to: LocalDate, maxCount: number): GeneratedStart[] {
  const startDate = datePart(schedule.start);
  const time = schedule.allDay ? null : schedule.start.slice(11, 16);
  if (schedule.lunarRule) {
    const rule = schedule.lunarRule;
    const lo = from > startDate ? from : startDate;
    const hi = rule.until && rule.until < to ? rule.until : to;
    if (lo > hi) return [];
    return lunarRuleDates(rule, lo, hi)
      .slice(0, maxCount)
      .map((h) => ({
        start: time ? `${h.date}T${time}` : h.date,
        ...(h.shortMonth ? { lunarShortMonth: true } : {}),
      }));
  }
  if (schedule.rrule) {
    const rule = parseRrule(schedule.rrule, toFloating(schedule.start));
    const after = toFloating(from);
    const before = new Date(toFloating(to).getTime() + 86_400_000 - 1);
    return rule.between(after, before, true, (_d, i) => i < maxCount).map((d) => ({ start: fromFloating(d, schedule.allDay) }));
  }
  return startDate >= from && startDate <= to ? [{ start: schedule.start }] : [];
}

function overlaps(start: string, end: string | undefined, window: DateWindow): boolean {
  const first = datePart(start);
  // A timed end at exactly midnight does not occupy that day.
  let last = end ? datePart(end) : first;
  if (end && end.length > 10 && end.endsWith("T00:00") && last > first) last = addDays(last, -1);
  return first <= window.to && last >= window.from;
}

/** Expands a schedule into occurrences overlapping `window`, applying CANCEL/OVERRIDE exceptions. */
export function expandOccurrences(
  itemId: string,
  schedule: Schedule,
  window: { from: LocalDate; to: LocalDate },
  exceptions: ItemException[] = [],
  maxCount: number = DEFAULT_MAX_OCCURRENCES,
): Occurrence[] {
  assertScheduleShape(schedule);
  if (!isLocalDate(window.from) || !isLocalDate(window.to)) throw new RangeError("Invalid window");
  if (window.from > window.to) return [];

  const duration = schedule.end !== undefined ? wallDurationMinutes(schedule.start, schedule.end) : null;
  const spanDays = duration === null ? 0 : Math.ceil(duration / 1440);
  const rangeFrom = addDays(window.from, -spanDays);
  const generated = generateStarts(schedule, rangeFrom, window.to, maxCount);

  const byKey = new Map<string, ItemException>();
  for (const e of exceptions) if (e.itemId === itemId) byKey.set(e.occurrenceKey, e);

  const build = (original: GeneratedStart, exception: ItemException | undefined): Occurrence => {
    const key = occurrenceKey(itemId, original.start);
    const end = duration === null ? undefined : shiftWall(original.start, duration, schedule.allDay);
    const occ: Occurrence = { itemId, occurrenceKey: key, start: original.start, allDay: schedule.allDay, overridden: false };
    if (end !== undefined) occ.end = end;
    if (original.lunarShortMonth) occ.lunarShortMonth = true;
    if (exception?.kind !== "OVERRIDE" || !exception.override) return occ;
    const o = exception.override;
    const allDay = o.allDay ?? schedule.allDay;
    const start = o.start ?? (allDay === schedule.allDay ? original.start : datePart(original.start));
    let newEnd = o.end;
    if (newEnd === undefined && duration !== null && allDay === schedule.allDay) newEnd = shiftWall(start, duration, allDay);
    const out: Occurrence = { ...occ, start, allDay, overridden: true };
    if (newEnd === undefined) delete out.end;
    else out.end = newEnd;
    if (o.title !== undefined) out.title = o.title;
    return out;
  };

  const result: Occurrence[] = [];
  const seen = new Set<string>();
  for (const g of generated) {
    const key = occurrenceKey(itemId, g.start);
    seen.add(key);
    const exception = byKey.get(key);
    if (exception?.kind === "CANCEL") continue;
    const occ = build(g, exception);
    if (overlaps(occ.start, occ.end, window)) result.push(occ);
  }

  // Overrides can move an occurrence into the window from a date outside the expanded range.
  for (const exception of byKey.values()) {
    if (exception.kind !== "OVERRIDE" || seen.has(exception.occurrenceKey)) continue;
    const parsed = parseOccurrenceKey(exception.occurrenceKey);
    if (!parsed) continue;
    const day = datePart(parsed.originalStart);
    if (!isLocalDate(day)) continue;
    const original = generateStarts(schedule, day, day, maxCount).find((g) => g.start === parsed.originalStart);
    if (!original) continue;
    const occ = build(original, exception);
    if (overlaps(occ.start, occ.end, window)) result.push(occ);
  }

  return result.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.occurrenceKey < b.occurrenceKey ? -1 : 1));
}
