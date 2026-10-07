import { t } from "@/i18n/vi";

const DAY_MS = 86_400_000;

/** Whole days between two 'YYYY-MM-DD' strings; computed in UTC so DST never adds or drops a day. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function countdownLabel(days: number): string {
  if (days === 0) return t("common.today");
  if (days === 1) return t("common.tomorrow");
  return t("common.daysLeft", { n: days });
}
