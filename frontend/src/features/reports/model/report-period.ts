import type { AccessContext } from "@/core/access/evaluate";
import type { LocalDataView } from "@/core/repo/data-view";
import { addDays, endOfMonth, startOfWeek, type LocalDate } from "@/core/time/local-date";
import { reportForMonth } from "./report-month";

export type ReportPeriod = "MONTH" | "WEEK";
export function periodWindow(date: LocalDate, period: ReportPeriod, weekStartsOn: 0 | 1 = 1) {
  const from = period === "MONTH" ? date.slice(0, 7) + "-01" : startOfWeek(date, weekStartsOn);
  return { from, to: period === "MONTH" ? endOfMonth(from) : addDays(from, 6) };
}
export function reportForPeriod(data: LocalDataView, date: LocalDate, period: ReportPeriod, ctx: AccessContext, today: LocalDate) {
  const window = periodWindow(date, period, data.space.settings?.weekStartsOn ?? 1);
  return reportForMonth(data, date.slice(0, 7), ctx, period === "MONTH" ? { today } : { today, window, previousWindow: { from: addDays(window.from, -7), to: addDays(window.to, -7) } });
}
