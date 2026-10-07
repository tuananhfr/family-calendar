import {
  examReviewDate,
  isExamTitle,
  paymentNoticeDue,
  ruleParams,
  weeklySummaryKey,
} from './automation-rules';

describe('ruleParams', () => {
  it('fills defaults and clamps what users typed', () => {
    expect(ruleParams('WEEKLY_SUMMARY', {})).toEqual({ hour: 19 });
    expect(ruleParams('WEEKLY_SUMMARY', { hour: 30 })).toEqual({ hour: 23 });
    expect(ruleParams('PAYMENT_DUE_REMINDER', { days_before: '5' })).toEqual({ days_before: 3 });
    expect(ruleParams('PAYMENT_DUE_REMINDER', { days_before: 0 })).toEqual({ days_before: 1 });
    expect(ruleParams('EXAM_REVIEW_TASK', { days_before: 7.6 })).toEqual({ days_before: 8 });
  });
});

describe('weeklySummaryKey', () => {
  it('fires on Sunday from the configured hour, keyed by that Sunday', () => {
    expect(weeklySummaryKey('2026-10-11T19:00', { hour: 19 })).toBe('2026-10-11');
    expect(weeklySummaryKey('2026-10-11T23:59', { hour: 19 })).toBe('2026-10-11');
    expect(weeklySummaryKey('2026-10-11T18:59', { hour: 19 })).toBeNull();
    expect(weeklySummaryKey('2026-10-10T20:00', { hour: 19 })).toBeNull();
    expect(weeklySummaryKey('2026-10-12T20:00', { hour: 19 })).toBeNull();
  });
});

describe('paymentNoticeDue', () => {
  it('is due from N days before the payment until its day', () => {
    expect(paymentNoticeDue('2026-10-14', '2026-10-11', 3)).toBe(true);
    expect(paymentNoticeDue('2026-10-14', '2026-10-14', 3)).toBe(true);
    expect(paymentNoticeDue('2026-10-14', '2026-10-10', 3)).toBe(false);
    expect(paymentNoticeDue('2026-10-14', '2026-10-15', 3)).toBe(false);
  });
});

describe('exam review', () => {
  it('recognises exams in Vietnamese with or without diacritics', () => {
    expect(isExamTitle('Thi giữa kỳ Toán')).toBe(true);
    expect(isExamTitle('kiem tra 15 phut')).toBe(true);
    expect(isExamTitle('Kiểm tra Văn')).toBe(true);
    expect(isExamTitle('Học thêm Anh văn')).toBe(false);
    expect(isExamTitle('Thiết kế poster')).toBe(false);
  });

  it('schedules the review N days before, never in the past', () => {
    expect(examReviewDate('2026-10-20', '2026-10-07', 3)).toBe('2026-10-17');
    expect(examReviewDate('2026-10-09', '2026-10-07', 3)).toBe('2026-10-07');
  });
});
