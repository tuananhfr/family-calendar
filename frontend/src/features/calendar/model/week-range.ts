import { addDays, parseLocalDate, startOfWeek, type LocalDate } from "@/core/time/local-date";

export interface WeekRange {
  from: LocalDate;
  to: LocalDate;
  days: LocalDate[];
}

/** The 7 days of the week containing `anchor`; weekStartsOn comes from Space settings (1 = T2, 0 = CN). */
export function weekRange(anchor: LocalDate, weekStartsOn: 1 | 0): WeekRange {
  const from = startOfWeek(anchor, weekStartsOn);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return { from, to: days[6], days };
}

export function shiftWeek(anchor: LocalDate, weeks: number): LocalDate {
  return addDays(anchor, weeks * 7);
}

/** '5 – 11/10/2026', '28/9 – 4/10/2026', '28/12/2026 – 3/1/2027'. */
export function weekRangeLabel(range: Pick<WeekRange, "from" | "to">): string {
  const a = parseLocalDate(range.from);
  const b = parseLocalDate(range.to);
  const end = `${b.day}/${b.month}/${b.year}`;
  if (a.year !== b.year) return `${a.day}/${a.month}/${a.year} – ${end}`;
  if (a.month !== b.month) return `${a.day}/${a.month} – ${end}`;
  return `${a.day} – ${end}`;
}
