import { addDays, dayOfWeek, type LocalDate } from '../../../common/time/local-date';
import type { LocalDateTime } from '../../../common/time/zoned';

export type AutomationRuleKey = 'PAYMENT_DUE_REMINDER' | 'WEEKLY_SUMMARY' | 'EXAM_REVIEW_TASK';

export interface RuleParams {
  hour?: number;
  days_before?: number;
}

function intParam(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

/** Params are free-form JSON written by clients; only known keys survive, clamped to sane ranges. */
export function ruleParams(rule: AutomationRuleKey, raw: Record<string, unknown>): RuleParams {
  if (rule === 'WEEKLY_SUMMARY') return { hour: intParam(raw.hour, 19, 0, 23) };
  return { days_before: intParam(raw.days_before, 3, 1, 30) };
}

/**
 * The Sunday that names this week's summary, or null when it is not yet time. Any tick from the configured hour
 * until midnight qualifies, so a worker that was down at 19:00 still sends it later that evening.
 */
export function weeklySummaryKey(nowLocal: LocalDateTime, params: RuleParams): LocalDate | null {
  const date = nowLocal.slice(0, 10);
  if (dayOfWeek(date) !== 0) return null;
  return Number(nowLocal.slice(11, 13)) >= (params.hour ?? 19) ? date : null;
}

export function paymentNoticeDue(dueDate: LocalDate, today: LocalDate, daysBefore: number): boolean {
  return today <= dueDate && today >= addDays(dueDate, -daysBefore);
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Keyword match only (no AI); "thi" must be a whole word so "Thiết kế" or "thiếu nhi" do not count. */
export function isExamTitle(title: string): boolean {
  return /(^|[^a-z0-9])(thi|kiem tra)($|[^a-z0-9])/.test(fold(title));
}

export function examReviewDate(examDate: LocalDate, today: LocalDate, daysBefore: number): LocalDate {
  const wanted = addDays(examDate, -daysBefore);
  return wanted < today ? today : wanted;
}
