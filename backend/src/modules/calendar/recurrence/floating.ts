// Deliberate copy of frontend/src/core/recurrence/floating.ts (ARC-02); change both sides together.
// "Floating" time: a Date whose UTC fields carry the wall clock, the representation rrule.js expects when no
// TZID is set. It never denotes a real instant, so it is only used inside recurrence math.
import { formatLocalDate, isLocalDate, type LocalDate } from '../../../common/time/local-date';
import { isLocalDateTime, type LocalDateTime } from '../../../common/time/zoned';

export function toFloating(value: LocalDate | LocalDateTime): Date {
  if (!isLocalDate(value) && !isLocalDateTime(value)) throw new RangeError(`Invalid schedule value: ${value}`);
  return new Date(
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(5, 7)) - 1,
      Number(value.slice(8, 10)),
      value.length > 10 ? Number(value.slice(11, 13)) : 0,
      value.length > 10 ? Number(value.slice(14, 16)) : 0,
    ),
  );
}

export function fromFloating(d: Date, allDay: boolean): LocalDate | LocalDateTime {
  const date = formatLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  if (allDay) return date;
  return `${date}T${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Wall-clock length of start→end in minutes (all-day values count whole days). */
export function wallDurationMinutes(start: LocalDate | LocalDateTime, end: LocalDate | LocalDateTime): number {
  return Math.round((toFloating(end).getTime() - toFloating(start).getTime()) / 60000);
}

export function shiftWall(
  value: LocalDate | LocalDateTime,
  minutes: number,
  allDay: boolean,
): LocalDate | LocalDateTime {
  return fromFloating(new Date(toFloating(value).getTime() + minutes * 60000), allDay);
}
