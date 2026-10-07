import { escapeText, foldLine, writeIcs } from './ics-writer';

const stamp = new Date('2026-10-07T03:00:00.000Z');

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and newlines (RFC 5545 3.3.11)', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });
});

describe('foldLine', () => {
  it('keeps lines of 75 octets and folds longer ones with a leading space', () => {
    expect(foldLine('x'.repeat(75))).toBe('x'.repeat(75));
    expect(foldLine('x'.repeat(80))).toBe(`${'x'.repeat(75)}\r\n ${'x'.repeat(5)}`);
  });

  it('never splits a multi-byte character and keeps every physical line within 75 octets', () => {
    const line = `SUMMARY:${'Giỗ ông bà nội ngoại '.repeat(8)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line);
  });
});

describe('writeIcs', () => {
  const ics = writeIcs({
    name: 'Nhà mình',
    timeZone: 'Asia/Ho_Chi_Minh',
    events: [
      {
        uid: 'a@lich-gia-dinh',
        stamp,
        start: { at: new Date('2026-10-10T01:00:00.000Z') },
        end: { at: new Date('2026-10-10T02:30:00.000Z') },
        summary: 'Họp phụ huynh, lớp 3A',
        description: 'Thành viên: Mẹ',
      },
      { uid: 'b@lich-gia-dinh', stamp, start: { date: '2026-12-31' }, summary: 'Giao thừa' },
    ],
  });

  it('is a CRLF calendar with one VEVENT per occurrence', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('X-WR-CALNAME:Nhà mình\r\n');
    expect(ics).toContain('X-WR-TIMEZONE:Asia/Ho_Chi_Minh\r\n');
  });

  it('writes timed events in UTC and all-day events as dates with an exclusive end', () => {
    expect(ics).toContain('DTSTART:20261010T010000Z\r\nDTEND:20261010T023000Z\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n');
    expect(ics).toContain('DTSTAMP:20261007T030000Z\r\n');
    expect(ics).toContain('SUMMARY:Họp phụ huynh\\, lớp 3A\r\n');
    expect(ics).toContain('DESCRIPTION:Thành viên: Mẹ\r\n');
  });
});
