import { FOREIGN_TIME_ZONES, withProcessTimeZone } from '../../../test/helpers/process-tz';
import { instantToZoned, isLocalDateTime, timeZoneOffsetMinutes, todayIn, zonedToInstant } from './zoned';

function runAll() {
  const instant = new Date('2026-10-05T17:30:00Z');
  expect(todayIn('Asia/Ho_Chi_Minh', instant)).toBe('2026-10-06');
  expect(todayIn('America/Los_Angeles', instant)).toBe('2026-10-05');

  expect(zonedToInstant('2026-10-06T07:00', 'Asia/Ho_Chi_Minh').toISOString()).toBe('2026-10-06T00:00:00.000Z');
  expect(instantToZoned(new Date('2026-10-06T00:00:00Z'), 'Asia/Ho_Chi_Minh')).toBe('2026-10-06T07:00');

  // Spring-forward gap: 02:30 does not exist in New York on 2026-03-08; we resolve it forward to 03:30 EDT
  // (Temporal "compatible" disambiguation), so a reminder still fires right after the intended time.
  const gap = zonedToInstant('2026-03-08T02:30', 'America/New_York');
  expect(gap.toISOString()).toBe('2026-03-08T07:30:00.000Z');
  expect(instantToZoned(gap, 'America/New_York')).toBe('2026-03-08T03:30');

  // Fall-back overlap: 01:30 happens twice on 2026-11-01; the earlier (EDT) instant wins.
  const overlap = zonedToInstant('2026-11-01T01:30', 'America/New_York');
  expect(overlap.toISOString()).toBe('2026-11-01T05:30:00.000Z');
  expect(instantToZoned(overlap, 'America/New_York')).toBe('2026-11-01T01:30');

  for (const tz of ['Asia/Ho_Chi_Minh', 'America/New_York', 'Europe/Berlin', 'Pacific/Kiritimati']) {
    for (const local of ['2026-01-01T00:00', '2026-06-15T09:45', '2026-12-31T23:59']) {
      expect(instantToZoned(zonedToInstant(local, tz), tz)).toBe(local);
    }
  }
  expect(timeZoneOffsetMinutes(new Date('2026-07-01T00:00:00Z'), 'America/New_York')).toBe(-240);
  expect(timeZoneOffsetMinutes(new Date('2026-07-01T00:00:00Z'), 'Asia/Ho_Chi_Minh')).toBe(420);
}

describe('zoned', () => {
  it('converts between local wall time and instants', () => {
    runAll();
  });

  it('validates LocalDateTime strings', () => {
    expect(isLocalDateTime('2026-10-06T07:00')).toBe(true);
    expect(isLocalDateTime('2026-10-06T24:00')).toBe(false);
    expect(isLocalDateTime('2026-02-30T07:00')).toBe(false);
    expect(isLocalDateTime('2026-10-06')).toBe(false);
    expect(() => zonedToInstant('2026-10-06', 'Asia/Ho_Chi_Minh')).toThrow();
  });

  it.each(FOREIGN_TIME_ZONES)('is independent of the machine zone (%s) — Review Focus #3', (tz) => {
    withProcessTimeZone(tz, runAll);
  });
});
