import { savingMaturityDate, type FinanceSaving } from "@/core/model/finance";
import { addDays, daysBetween, type LocalDate } from "@/core/time/local-date";

/** modules.md §7: "Đến hạn sổ tiết kiệm" reminder 7 days ahead. */
export const MATURITY_REMINDER_DAYS = 7;

export function maturityDate(start: LocalDate, termMonths: number): LocalDate {
  return savingMaturityDate(start, termMonths);
}

export function maturityReminderDate(saving: Pick<FinanceSaving, "startDate" | "termMonths">): LocalDate {
  return addDays(maturityDate(saving.startDate, saving.termMonths), -MATURITY_REMINDER_DAYS);
}

export function savingStatus(
  saving: Pick<FinanceSaving, "startDate" | "termMonths">,
  today: LocalDate,
): { maturity: LocalDate; daysLeft: number; matured: boolean } {
  const maturity = maturityDate(saving.startDate, saving.termMonths);
  const daysLeft = daysBetween(today, maturity);
  return { maturity, daysLeft, matured: daysLeft <= 0 };
}
