import type { LocalDate } from "../time/local-date";
import type { LocalDateTime } from "../time/zoned";

/** Lunar repetition (modules.md §5); replaces RRULE when calendar_system = LUNAR. */
export interface LunarRule {
  freq: "YEARLY" | "MONTHLY";
  /** Lunar day 1..30; 30 falls back to 29 in a 29-day month. */
  day: number;
  /** Lunar month 1..12, required for YEARLY. YEARLY never matches a leap month. */
  month?: number;
  /** MONTHLY only: also repeat in the leap month. */
  includeLeap: boolean;
  /** Last solar date (inclusive) of the series; set when a series is split. */
  until?: LocalDate;
}

export interface Schedule {
  allDay: boolean;
  /** LocalDate when allDay, LocalDateTime otherwise — wall time in `timeZone`. */
  start: LocalDate | LocalDateTime;
  /** Same shape as `start`; for all-day it is the last day (inclusive). */
  end?: LocalDate | LocalDateTime;
  timeZone: string;
  /** RFC 5545 RRULE body without DTSTART, e.g. 'FREQ=WEEKLY;BYDAY=MO,WE'. UNTIL is read as floating local time. */
  rrule?: string;
  /** Takes precedence over `rrule` when both are present. */
  lunarRule?: LunarRule;
}

export interface ItemException {
  id: string;
  itemId: string;
  occurrenceKey: string;
  kind: "CANCEL" | "OVERRIDE";
  override?: Partial<Pick<Schedule, "start" | "end" | "allDay">> & { title?: string };
}

export interface Occurrence {
  itemId: string;
  /** `${itemId}@${originalStart}` — unchanged when the occurrence is moved by an override. */
  occurrenceKey: string;
  start: LocalDate | LocalDateTime;
  end?: LocalDate | LocalDateTime;
  allDay: boolean;
  overridden: boolean;
  /** Present only when an override changed the title for this occurrence. */
  title?: string;
  /** Lunar day 30 requested but the month has 29 days; UI shows "tháng thiếu". */
  lunarShortMonth?: boolean;
}

/** Inclusive range of local dates in the Space time zone. */
export interface DateWindow {
  from: LocalDate;
  to: LocalDate;
}
