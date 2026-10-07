import { t } from "@/i18n/vi";

/** "Thời điểm nhắc trước" choices in minutes (IMG-B shows "10 phút trước"). */
export const OFFSET_CHOICES: readonly number[] = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 4320, 10080];

const DAY = 1440;
const WEEK = 7 * DAY;

export function offsetLabel(minutes: number, allDay: boolean): string {
  if (minutes === 0) return t(allDay ? "items.offsets.atDay" : "items.offsets.atTime");
  if (minutes % WEEK === 0) return t("items.offsets.weeks", { n: minutes / WEEK });
  if (minutes % DAY === 0) return t("items.offsets.days", { n: minutes / DAY });
  if (minutes % 60 === 0) return t("items.offsets.hours", { n: minutes / 60 });
  return t("items.offsets.minutes", { n: minutes });
}

export function offsetChoicesFor(allDay: boolean, current?: number): number[] {
  // Minutes before an all-day item would mean "the evening before", which reads as a bug.
  const base = allDay ? OFFSET_CHOICES.filter((m) => m % DAY === 0) : [...OFFSET_CHOICES];
  if (current !== undefined && !base.includes(current)) base.push(current);
  return base.sort((a, b) => a - b);
}
