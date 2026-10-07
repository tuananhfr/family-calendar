import type { Item } from "@/core/model/item";
import { wallDurationMinutes } from "@/core/recurrence/floating";
import type { Occurrence } from "@/core/recurrence/types";
import { addDays, type LocalDate } from "@/core/time/local-date";

export interface MemberWeekHours {
  memberId: string;
  study: number;
  activity: number;
}

/**
 * "Báo cáo" tab (modules.md §6): hours of timetable lessons in the week starting `week`, per member. A lesson
 * shared by two children counts for each. Members appear in the order first met; hours keep two decimals.
 */
export function weeklyHoursByMember(occs: Occurrence[], items: Item[], week: LocalDate): MemberWeekHours[] {
  const byId = new Map(items.filter((i) => i.deletedAt === null && i.preset === "TIMETABLE").map((i) => [i.id, i]));
  const last = addDays(week, 6);
  const minutes = new Map<string, { study: number; activity: number }>();
  for (const occ of occs) {
    const item = byId.get(occ.itemId);
    const day = occ.start.slice(0, 10);
    if (!item || occ.allDay || !occ.end || day < week || day > last) continue;
    const length = wallDurationMinutes(occ.start, occ.end);
    const bucket = item.category === "STUDY" ? "study" : "activity";
    for (const memberId of item.memberIds) {
      const m = minutes.get(memberId) ?? { study: 0, activity: 0 };
      m[bucket] += length;
      minutes.set(memberId, m);
    }
  }
  const hours = (min: number) => Math.round((min / 60) * 100) / 100;
  return [...minutes].map(([memberId, m]) => ({ memberId, study: hours(m.study), activity: hours(m.activity) }));
}
