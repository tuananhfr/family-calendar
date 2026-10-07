import { dayOfWeek, parseLocalDate } from "@/core/time/local-date";
import { datePart, timePart } from "@/core/time/zoned";
import { t } from "@/i18n/vi";

const WEEKDAY_KEYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/** "Thứ 3, 06/10/2026". */
export function formatDateVi(date: string): string {
  const { year, month, day } = parseLocalDate(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t(`items.weekdaysLong.${WEEKDAY_KEYS[dayOfWeek(date)]}`)}, ${pad(day)}/${pad(month)}/${year}`;
}

/** Human "when" of an occurrence; times are wall time in the Space time zone, never converted. */
export function formatWhen(o: { start: string; end?: string; allDay: boolean }): string {
  const startDay = datePart(o.start);
  const endDay = o.end ? datePart(o.end) : startDay;
  if (o.allDay) {
    return endDay !== startDay ? `${formatDateVi(startDay)} – ${formatDateVi(endDay)}` : `${formatDateVi(startDay)} · ${t("items.detail.allDay")}`;
  }
  const from = timePart(o.start);
  const to = o.end ? timePart(o.end) : null;
  if (!to) return `${formatDateVi(startDay)} · ${from}`;
  if (endDay !== startDay) return `${formatDateVi(startDay)} · ${from} – ${formatDateVi(endDay)} ${to}`;
  return `${formatDateVi(startDay)} · ${from} – ${to}`;
}
