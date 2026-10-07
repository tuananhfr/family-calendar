import { lateDecision } from './late-policy';

describe('late policy', () => {
  const at = new Date('2026-10-10T00:00:00Z');
  const after = (minutes: number) => new Date(at.getTime() + minutes * 60_000);

  it('gives medication a 60 minute grace window, then expires it', () => {
    expect(lateDecision('MEDICATION', at, after(0))).toBe('SEND');
    expect(lateDecision('MEDICATION', at, after(60))).toBe('SEND');
    expect(lateDecision('MEDICATION', at, after(61))).toBe('EXPIRE');
  });

  it('lets everything else be up to a day late', () => {
    for (const preset of ['PAYMENT', 'DOCUMENT', 'APPOINTMENT', 'EVENT']) {
      expect(lateDecision(preset, at, after(24 * 60))).toBe('SEND');
      expect(lateDecision(preset, at, after(24 * 60 + 1))).toBe('EXPIRE');
    }
  });

  it('sends early jobs as they are', () => {
    expect(lateDecision('MEDICATION', at, after(-5))).toBe('SEND');
  });
});
