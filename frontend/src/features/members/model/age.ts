import { ageOn } from "@/core/model/member";
import { compareLocalDate, parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { t } from "@/i18n/vi";

/** '10 tuổi', or months for babies; null when unknown or not born yet. */
export function ageLabel(birthDate: LocalDate | null | undefined, today: LocalDate): string | null {
  if (!birthDate || compareLocalDate(birthDate, today) > 0) return null;
  const years = ageOn(birthDate, today);
  if (years >= 1) return t("members.age", { n: years });
  const b = parseLocalDate(birthDate);
  const d = parseLocalDate(today);
  const months = (d.year - b.year) * 12 + (d.month - b.month) - (d.day < b.day ? 1 : 0);
  return t("members.ageMonths", { n: Math.max(0, months) });
}
