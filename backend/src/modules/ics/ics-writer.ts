import { addDays, type LocalDate } from '../../common/time/local-date';

export type IcsTime = { date: LocalDate } | { at: Date };

export interface IcsEvent {
  uid: string;
  stamp: Date;
  start: IcsTime;
  /** All-day: the last day (inclusive); written as the exclusive next day the format expects. */
  end?: IcsTime;
  summary: string;
  description?: string;
}

const MAX_OCTETS = 75;

/** TEXT value escaping (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** Folds at 75 octets (§3.1) on character boundaries, so Vietnamese diacritics are never cut in half. */
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= MAX_OCTETS) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const bytes = Buffer.byteLength(ch, 'utf8');
    // Continuation lines spend one octet on the leading space.
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function utc(at: Date): string {
  return at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function compactDate(d: LocalDate): string {
  return d.replace(/-/g, '');
}

function timeProps(name: 'DTSTART' | 'DTEND', t: IcsTime, exclusiveDate: boolean): string {
  if ('at' in t) return `${name}:${utc(t.at)}`;
  return `${name};VALUE=DATE:${compactDate(exclusiveDate ? addDays(t.date, 1) : t.date)}`;
}

export function writeIcs(cal: { name: string; timeZone: string; events: IcsEvent[] }): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lich Gia Dinh//Lich Gia Dinh 1.0//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(cal.name)}`,
    `X-WR-TIMEZONE:${cal.timeZone}`,
  ];
  for (const ev of cal.events) {
    lines.push('BEGIN:VEVENT', `UID:${ev.uid}`, `DTSTAMP:${utc(ev.stamp)}`, timeProps('DTSTART', ev.start, false));
    if ('date' in ev.start) lines.push(timeProps('DTEND', ev.end ?? ev.start, true));
    else if (ev.end) lines.push(timeProps('DTEND', ev.end, false));
    lines.push(`SUMMARY:${escapeText(ev.summary)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
