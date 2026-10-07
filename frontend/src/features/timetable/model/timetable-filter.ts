import type { OccurrenceEntry } from "@/features/items";

export const TIMETABLE_TABS = ["WEEK", "DAY", "MEMBER", "STUDY", "ACTIVITY", "REPORT"] as const;
export type TimetableTab = (typeof TIMETABLE_TABS)[number];

/** Lessons for a tab; "Ngoại khóa" is any non-study category, matching how the report splits hours. */
export function timetableEntries(entries: OccurrenceEntry[], tab: TimetableTab, memberId?: string): OccurrenceEntry[] {
  return entries.filter(({ item }) => {
    if (item.preset !== "TIMETABLE") return false;
    if (tab === "STUDY") return item.category === "STUDY";
    if (tab === "ACTIVITY") return item.category !== "STUDY";
    if (tab === "MEMBER") return !!memberId && item.memberIds.includes(memberId);
    return true;
  });
}

/** Downloadable sample; headers match what parseTimetableCsv looks for. */
export const TIMETABLE_TEMPLATE_CSV = ["Thứ,Bắt đầu,Kết thúc,Môn/Hoạt động,Thành viên,Danh mục", "Thứ 2,07:00,07:45,Toán,Bin,Học tập", "Thứ 4,17:00,18:00,Bơi,Bin,Ngoại khóa", ""].join("\n");
