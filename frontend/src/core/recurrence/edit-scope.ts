import { newId } from "../ids";
import { addDays, type LocalDate } from "../time/local-date";
import { datePart, type LocalDateTime } from "../time/zoned";
import { expandOccurrences } from "./expand";
import { shiftWall, wallDurationMinutes } from "./floating";
import { occurrenceKey } from "./occurrence-key";
import type { ItemException, Schedule } from "./types";

/** "Chỉ lần này" / "Từ lần này trở đi" / "Cả chuỗi". */
export type EditScope = "THIS" | "FOLLOWING" | "ALL";

function rruleParts(body: string): [string, string][] {
  return body
    .replace(/^RRULE:/i, "")
    .split(";")
    .filter(Boolean)
    .map((p) => {
      const eq = p.indexOf("=");
      return [p.slice(0, eq).toUpperCase(), p.slice(eq + 1)] as [string, string];
    });
}

function joinParts(parts: [string, string][]): string {
  return parts.map(([k, v]) => `${k}=${v}`).join(";");
}

function setPart(parts: [string, string][], key: string, value: string): [string, string][] {
  return parts.some(([k]) => k === key) ? parts.map(([k, v]) => [k, k === key ? value : v]) : [...parts, [key, value]];
}

/**
 * Splits a series for "từ lần này trở đi": head keeps the item id (and so every past occurrence key and its
 * completion state); tail becomes a new item starting at `fromOriginalStart`. COUNT is shared so the total stays.
 */
export function splitSeriesAt(
  schedule: Schedule,
  fromOriginalStart: LocalDate | LocalDateTime,
): { head: Schedule; tail: Schedule } {
  if (!schedule.rrule && !schedule.lunarRule) throw new RangeError("Cannot split a non-recurring schedule");
  if (fromOriginalStart <= schedule.start) throw new RangeError("Split point must be after the first occurrence");
  const dayBefore = addDays(datePart(fromOriginalStart), -1);
  const tailEnd =
    schedule.end === undefined
      ? undefined
      : shiftWall(fromOriginalStart, wallDurationMinutes(schedule.start, schedule.end), schedule.allDay);
  const tailBase: Schedule = { ...schedule, start: fromOriginalStart };
  if (tailEnd === undefined) delete tailBase.end;
  else tailBase.end = tailEnd;

  if (schedule.lunarRule) {
    const until = schedule.lunarRule.until;
    return {
      head: { ...schedule, lunarRule: { ...schedule.lunarRule, until: until && until < dayBefore ? until : dayBefore } },
      tail: { ...tailBase, lunarRule: { ...schedule.lunarRule } },
    };
  }

  const parts = rruleParts(schedule.rrule!);
  const untilValue = dayBefore.replace(/-/g, "") + (schedule.allDay ? "" : "T235959");
  const headParts = setPart(
    parts.filter(([k]) => k !== "COUNT"),
    "UNTIL",
    untilValue,
  );
  let tailParts = parts;
  const count = parts.find(([k]) => k === "COUNT");
  if (count) {
    const total = Number(count[1]);
    const headCount = expandOccurrences("split", schedule, { from: datePart(schedule.start), to: dayBefore }, [], total).length;
    tailParts = setPart(parts, "COUNT", String(Math.max(total - headCount, 0)));
  }
  return {
    head: { ...schedule, rrule: joinParts(headParts) },
    tail: { ...tailBase, rrule: joinParts(tailParts) },
  };
}

export function makeCancelException(itemId: string, originalStart: LocalDate | LocalDateTime): ItemException {
  return { id: newId(), itemId, occurrenceKey: occurrenceKey(itemId, originalStart), kind: "CANCEL" };
}

export function makeOverrideException(
  itemId: string,
  originalStart: LocalDate | LocalDateTime,
  override: NonNullable<ItemException["override"]>,
): ItemException {
  return { id: newId(), itemId, occurrenceKey: occurrenceKey(itemId, originalStart), kind: "OVERRIDE", override };
}
