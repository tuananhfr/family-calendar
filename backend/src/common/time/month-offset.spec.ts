import { FOREIGN_TIME_ZONES, withProcessTimeZone } from '../../../test/helpers/process-tz';
import { addMonthsClamped } from './month-offset';

function runAll() {
  expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28');
  expect(addMonthsClamped('2028-03-31', -1)).toBe('2028-02-29');
  expect(addMonthsClamped('2026-08-31', -6)).toBe('2026-02-28');
  expect(addMonthsClamped('2026-01-15', -6)).toBe('2025-07-15');
  expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
  expect(addMonthsClamped('2026-11-30', 3)).toBe('2027-02-28');
  expect(addMonthsClamped('2026-10-06', 0)).toBe('2026-10-06');
  expect(addMonthsClamped('2026-10-06', 24)).toBe('2028-10-06');
}

describe('addMonthsClamped', () => {
  it('shifts calendar months and clamps to the end of the target month', () => {
    runAll();
  });

  it.each(FOREIGN_TIME_ZONES)('is independent of the machine zone (%s)', (tz) => {
    withProcessTimeZone(tz, runAll);
  });
});
