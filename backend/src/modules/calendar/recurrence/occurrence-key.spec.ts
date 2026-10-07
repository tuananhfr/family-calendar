import { nextBirthdayDate } from './birthday';
import { occurrenceKey, parseOccurrenceKey } from './occurrence-key';

describe('occurrenceKey', () => {
  it('joins item id and original start', () => {
    expect(occurrenceKey('abc', '2026-10-05T07:00')).toBe('abc@2026-10-05T07:00');
    expect(occurrenceKey('abc', '2026-10-05')).toBe('abc@2026-10-05');
  });

  it('parses back', () => {
    expect(parseOccurrenceKey('abc@2026-10-05T07:00')).toEqual({ itemId: 'abc', originalStart: '2026-10-05T07:00' });
    expect(parseOccurrenceKey('nope')).toBeNull();
  });
});

describe('nextBirthdayDate', () => {
  it('moves 29/02 to 28/02 in non-leap years', () => {
    expect(nextBirthdayDate(2, 29, 2027)).toBe('2027-02-28');
    expect(nextBirthdayDate(2, 29, 2028)).toBe('2028-02-29');
    expect(nextBirthdayDate(2, 29, 2100)).toBe('2100-02-28');
    expect(nextBirthdayDate(10, 20, 2026)).toBe('2026-10-20');
  });
});
