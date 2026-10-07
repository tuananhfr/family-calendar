"use client";

import { useMemo } from "react";
import { parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { cn } from "@/design/cn";
import { useItemEditor, type OccurrenceEntry } from "@/features/items";
import { t } from "@/i18n/vi";
import { shortDateVi, weekdayCode } from "../model/calendar-entries";
import { monthMatrix } from "../model/month-matrix";
import { AllDayChip, lunarDayLabel } from "./WeekGrid";

const MAX_CHIPS = 3;

/** Month view (secondary, UX-003): 6×7 cells with lunar days; wide screens show chips, phones show dots. */
export function MonthGrid({
  year,
  month,
  weekStartsOn,
  byDay,
  today,
  onOpenDay,
}: {
  year: number;
  month: number;
  weekStartsOn: 0 | 1;
  byDay: Map<LocalDate, OccurrenceEntry[]>;
  today: LocalDate;
  onOpenDay: (d: LocalDate) => void;
}) {
  const openDetail = useItemEditor((s) => s.openDetail);
  const rows = useMemo(() => monthMatrix(year, month, weekStartsOn), [year, month, weekStartsOn]);
  return (
    <div role="grid" aria-label={t("calendar.views.month")} data-testid="month-grid">
      <div role="row" className="grid grid-cols-7 border-b border-border">
        {rows[0].map((c) => (
          <span key={c.date} role="columnheader" className="py-2 text-center text-xs font-semibold text-muted">
            {t(`calendar.weekdayShort.${weekdayCode(c.date)}`)}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row[0].date} role="row" className="grid grid-cols-7">
          {row.map((cell) => {
            const entries = byDay.get(cell.date) ?? [];
            const isToday = cell.date === today;
            const lunar = lunarDayLabel(cell.date);
            const extra = entries.length - MAX_CHIPS;
            const label = shortDateVi(cell.date);
            return (
              <div
                key={cell.date}
                role="gridcell"
                aria-current={isToday ? "date" : undefined}
                className={cn("flex min-h-16 min-w-0 flex-col gap-1 border-b border-l border-border p-1 first:border-l-0 md:min-h-28 md:p-1.5", !cell.inMonth && "bg-surface-2")}
              >
                <button
                  type="button"
                  onClick={() => onOpenDay(cell.date)}
                  aria-label={t("calendar.openDay", { date: label })}
                  className="flex items-baseline justify-between gap-1 rounded-[6px] px-0.5 hover:bg-primary-soft"
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-sm font-bold tabular-nums md:size-7",
                      isToday ? "bg-primary text-on-primary" : cell.inMonth ? "text-text" : "text-muted",
                    )}
                  >
                    {parseLocalDate(cell.date).day}
                  </span>
                  <span className={cn("text-[0.625rem] tabular-nums md:text-[0.6875rem]", lunar.strong ? "font-bold text-danger" : "text-muted")}>{lunar.text}</span>
                </button>
                {entries.length > 0 ? (
                  <>
                    <ul className="hidden min-w-0 flex-col gap-0.5 md:flex">
                      {entries.slice(0, MAX_CHIPS).map((e) => (
                        <li key={e.occurrence.occurrenceKey} className="min-w-0">
                          <AllDayChip entry={e} onOpen={() => openDetail(e.item.id, e.occurrence.occurrenceKey)} className="text-[0.6875rem] font-medium" />
                        </li>
                      ))}
                      {extra > 0 ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => onOpenDay(cell.date)}
                            aria-label={t("calendar.moreLabel", { n: extra, date: label })}
                            className="px-1 text-[0.6875rem] font-semibold text-primary hover:underline"
                          >
                            {t("calendar.more", { n: extra })}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                    <span aria-hidden className="flex flex-wrap justify-center gap-0.5 md:hidden">
                      {entries.slice(0, 4).map((e) => (
                        <span key={e.occurrence.occurrenceKey} className="size-1.5 rounded-full" style={{ background: `var(--cat-${e.item.category.toLowerCase()}-dot)` }} />
                      ))}
                    </span>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
