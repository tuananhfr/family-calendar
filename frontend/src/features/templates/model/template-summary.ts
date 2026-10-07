import { offsetLabel, type TemplateDef } from "@/features/items";
import { t } from "@/i18n/vi";

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return t("templates.duration.minutes", { m });
  return m === 0 ? t("templates.duration.hours", { h }) : t("templates.duration.hoursMinutes", { h, m });
}

export function templateTimeLabel(tpl: TemplateDef): string {
  if (tpl.allDay || !tpl.startTime) return t("templates.allDay");
  return tpl.durationMinutes ? `${tpl.startTime} · ${durationLabel(tpl.durationMinutes)}` : tpl.startTime;
}

/** Month offsets come first: they are the furthest ahead (documents: 6 tháng, 3 tháng, then days). */
export function templateReminderLabel(tpl: TemplateDef): string {
  const months = (tpl.reminderOffsetMonths ?? []).map((n) => t("items.offsets.months", { n }));
  const minutes = tpl.reminderOffsets.map((m) => offsetLabel(m, tpl.allDay));
  return [...months, ...minutes].join(", ");
}
