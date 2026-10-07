import type { Item } from "../model/item";
import type { ItemExceptionRecord } from "../model/occurrence";
import { expandOccurrences } from "../recurrence/expand";
import { addDays } from "../time/local-date";
import { todayIn, zonedToInstant } from "../time/zoned";

export interface IcsOptions {
  /** PRIVATE scope or PRIVATE data class; off by default (domain-model.md Portability). */
  includePrivate?: boolean;
  /** SENSITIVE (health) items; off by default. */
  includeSensitive?: boolean;
  /** Lunar repeats are expanded this many years ahead. */
  lunarYears?: number;
  now?: Date;
  calendarName?: string;
}

const PRODID = "-//Lich Gia Dinh//Lich Gia Dinh 1.0//VI";
const UID_DOMAIN = "lich-gia-dinh";
const DEFAULT_LUNAR_YEARS = 3;

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 §3.1: lines over 75 octets continue on the next line after CRLF + space, never splitting a character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + n > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compactDate = (d: string) => d.slice(0, 10).replace(/-/g, "");
const compactDateTime = (dt: string) => `${compactDate(dt)}T${dt.slice(11, 13)}${dt.slice(14, 16)}00`;
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function dateProp(name: string, value: string, allDay: boolean, timeZone: string): string {
  return allDay ? `${name};VALUE=DATE:${compactDate(value)}` : `${name};TZID=${timeZone}:${compactDateTime(value)}`;
}

/** RFC 5545 requires UNTIL in UTC when DTSTART has a TZID; ours is stored as floating local time. */
function icsRrule(rrule: string, allDay: boolean, timeZone: string): string {
  return rrule.replace(/UNTIL=(\d{8})(T(\d{6}))?(Z?)/, (match, date: string, _t, time: string | undefined, z: string) => {
    if (z || allDay) return allDay ? `UNTIL=${date}` : match;
    const local = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${(time ?? "235959").slice(0, 2)}:${(time ?? "235959").slice(2, 4)}`;
    return `UNTIL=${utcStamp(zonedToInstant(local, timeZone))}`;
  });
}

function exportable(item: Item, opts: IcsOptions): boolean {
  if (item.deletedAt !== null) return false;
  if (!opts.includePrivate && (item.sharingScope === "PRIVATE" || item.dataClass === "PRIVATE")) return false;
  return !!opts.includeSensitive || item.dataClass !== "SENSITIVE";
}

/** End for DTEND: all-day `end` is the last day (inclusive) but ICS DTEND is exclusive. */
function endProp(start: string, end: string | undefined, allDay: boolean, timeZone: string): string | null {
  if (allDay) return dateProp("DTEND", addDays((end ?? start).slice(0, 10), 1), true, timeZone);
  return end ? dateProp("DTEND", end, false, timeZone) : null;
}

function eventLines(item: Item, uid: string, stamp: string, start: string, end: string | undefined, allDay: boolean, title: string): string[] {
  const tz = item.schedule.timeZone;
  const lines = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`, dateProp("DTSTART", start, allDay, tz)];
  const dtend = endProp(start, end, allDay, tz);
  if (dtend) lines.push(dtend);
  lines.push(`SUMMARY:${escapeText(title)}`);
  if (item.locationText) lines.push(`LOCATION:${escapeText(item.locationText)}`);
  if (item.note) lines.push(`DESCRIPTION:${escapeText(item.note)}`);
  return lines;
}

/**
 * iCalendar export of the given items. Lunar repeats are written as separate dated events for `lunarYears`
 * (ICS has no lunar calendar); solar RRULEs are kept, with cancelled/moved occurrences as EXDATE/RECURRENCE-ID.
 */
export function exportIcs(items: Item[], exceptions: ItemExceptionRecord[], opts: IcsOptions = {}): string {
  const now = opts.now ?? new Date();
  const stamp = utcStamp(now);
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${PRODID}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (opts.calendarName) out.push(`X-WR-CALNAME:${escapeText(opts.calendarName)}`);

  for (const item of items.filter((i) => exportable(i, opts))) {
    const s = item.schedule;
    const own = exceptions.filter((e) => e.itemId === item.id && e.deletedAt === null);

    if (s.lunarRule) {
      const from = todayIn(s.timeZone, now);
      const to = addDays(from, 365 * (opts.lunarYears ?? DEFAULT_LUNAR_YEARS));
      for (const occ of expandOccurrences(item.id, s, { from, to }, own)) {
        const uid = `${item.id}-${compactDate(occ.occurrenceKey.split("@")[1])}@${UID_DOMAIN}`;
        out.push(...eventLines(item, uid, stamp, occ.start, occ.end, occ.allDay, occ.title ?? item.title), "END:VEVENT");
      }
      continue;
    }

    const uid = `${item.id}@${UID_DOMAIN}`;
    const main = eventLines(item, uid, stamp, s.start, s.end, s.allDay, item.title);
    if (s.rrule) {
      main.push(`RRULE:${icsRrule(s.rrule, s.allDay, s.timeZone)}`);
      for (const e of own.filter((x) => x.kind === "CANCEL")) main.push(dateProp("EXDATE", e.occurrenceKey.split("@")[1], s.allDay, s.timeZone));
    }
    out.push(...main, "END:VEVENT");

    if (!s.rrule) continue;
    for (const e of own.filter((x) => x.kind === "OVERRIDE" && x.override)) {
      const original = e.occurrenceKey.split("@")[1];
      const o = e.override!;
      const allDay = o.allDay ?? s.allDay;
      const lines = eventLines(item, uid, stamp, o.start ?? original, o.end, allDay, o.title ?? item.title);
      lines.splice(3, 0, dateProp("RECURRENCE-ID", original, s.allDay, s.timeZone));
      out.push(...lines, "END:VEVENT");
    }
  }

  out.push("END:VCALENDAR");
  return `${out.map(foldLine).join("\r\n")}\r\n`;
}
