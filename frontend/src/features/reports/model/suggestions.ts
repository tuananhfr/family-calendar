import type { MonthReport } from "./report-month";

export const MAX_SUGGESTIONS = 4;
export const HABIT_THRESHOLD = 70;
export const NO_ACTIVITY_DAYS = 14;

/** "Gợi ý cho gia đình" (modules.md §10): fixed rules over the report, no AI, at most four. */
export function familySuggestions(r: MonthReport): string[] {
  const out: string[] = [];
  for (const h of [...r.habits].sort((a, b) => a.percent - b.percent)) {
    if (h.percent < HABIT_THRESHOLD) out.push(`Duy trì thói quen "${h.title}" (${h.percent}% tháng này)`);
  }
  if (r.daysSinceActivity === null || r.daysSinceActivity >= NO_ACTIVITY_DAYS) out.push("Tăng hoạt động ngoài trời cùng cả nhà");
  if (r.tasks.total > 0 && r.tasks.done * 2 < r.tasks.total) out.push("Chia nhỏ việc cần làm để dễ hoàn thành hơn");
  if (r.members.total > 1 && !r.byCategory.some((c) => c.category === "FAMILY")) out.push("Lên lịch một hoạt động chung cho cả nhà");
  return out.slice(0, MAX_SUGGESTIONS);
}
