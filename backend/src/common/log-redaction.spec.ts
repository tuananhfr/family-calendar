import { redact } from './log-redaction';

describe('redact', () => {
  it('blanks family content at any depth and keeps structure and identifiers', () => {
    const input = {
      jobId: 'j1',
      item: { title: 'Thuốc huyết áp', note: 'sau ăn', amount: '500000', nested: [{ body: 'x', description: 'y' }] },
      push: { payload: '{"title":"Thuốc"}', token: 'abc', code: 'K7QM' },
      location: { latitude: 10.7, longitude: 106.6, accuracy: 20 },
      Title: 'Hoa',
    };
    const out = redact(input) as typeof input;
    expect(out.jobId).toBe('j1');
    expect(out.item.title).toBe('[REDACTED]');
    expect(out.item.note).toBe('[REDACTED]');
    expect(out.item.amount).toBe('[REDACTED]');
    expect(out.item.nested[0]).toEqual({ body: '[REDACTED]', description: '[REDACTED]' });
    expect(out.push).toEqual({ payload: '[REDACTED]', token: '[REDACTED]', code: '[REDACTED]' });
    expect(out.location).toEqual({ latitude: '[REDACTED]', longitude: '[REDACTED]', accuracy: 20 });
    expect(out.Title).toBe('[REDACTED]');
    expect(JSON.stringify(out)).not.toContain('huyết áp');
    expect(input.item.title).toBe('Thuốc huyết áp');
  });

  it('survives cycles, errors and primitives', () => {
    const a: Record<string, unknown> = { id: 1 };
    a.self = a;
    expect(redact(a)).toEqual({ id: 1, self: '[CIRCULAR]' });
    expect(redact('plain')).toBe('plain');
    expect(redact(null)).toBeNull();
    const err = redact(new TypeError('Thuốc huyết áp failed')) as Record<string, unknown>;
    expect(err).toEqual({ name: 'TypeError' });
  });
});
