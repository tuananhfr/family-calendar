"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { Card, IconButton } from "@/design/components";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import { shortDateVi, weekdayCode } from "../model/calendar-entries";
import { monthMatrix, monthTitle } from "../model/month-matrix";
import { lunarDayLabel } from "./WeekGrid";

/** Rail month picker (IMG-D): lunar day under each date, a dot on days with something planned. */
export function MiniMonth({
  shown,
  selected,
  today,
  weekStartsOn,
  busyDays,
  onShift,
  onPick,
}: {
  shown: { year: number; month: number };
  selected: LocalDate;
  today: LocalDate;
  weekStartsOn: 0 | 1;
  busyDays: Set<LocalDate>;
  onShift: (delta: 1 | -1) => void;
  onPick: (d: LocalDate) => void;
}) {
  const rows = useMemo(() => monthMatrix(shown.year, shown.month, weekStartsOn), [shown.year, shown.month, weekStartsOn]);
  return (
    <Card className="flex flex-col gap-2" aria-label={t("calendar.miniTitle")} role="region">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-text" aria-live="polite" data-testid="mini-title">
          {monthTitle(shown.year, shown.month)}
        </h2>
        <div className="flex gap-1">
          <IconButton label={t("calendar.miniPrev")} icon={<ChevronLeft className="size-4" />} onClick={() => onShift(-1)} />
          <IconButton label={t("calendar.miniNext")} icon={<ChevronRight className="size-4" />} onClick={() => onShift(1)} />
        </div>
      </div>
      <div className="grid grid-cols-7 text-center" data-testid="mini-month">
        {rows[0].map((c) => (
          <span key={c.date} aria-hidden className="pb-1 text-[0.6875rem] font-semibold text-muted">
            {t(`calendar.weekdayShort.${weekdayCode(c.date)}`)}
          </span>
        ))}
        {rows.flat().map((cell) => {
          const isSelected = cell.date === selected;
          const isToday = cell.date === today;
          const lunar = lunarDayLabel(cell.date);
          const busy = busyDays.has(cell.date);
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onPick(cell.date)}
              aria-label={`${t("calendar.openDay", { date: shortDateVi(cell.date) })}${busy ? `, ${t("calendar.hasEvents")}` : ""}`}
              aria-pressed={isSelected}
              className={cn(
                "relative flex min-h-11 flex-col items-center justify-center rounded-[8px] leading-none",
                isSelected ? "bg-primary text-on-primary" : isToday ? "bg-primary-soft text-primary" : "hover:bg-primary-soft",
                !cell.inMonth && !isSelected && "opacity-50",
              )}
            >
              <span className={cn("text-sm tabular-nums", isToday || isSelected ? "font-bold" : "font-medium", !isSelected && !isToday && "text-text")}>{parseLocalDate(cell.date).day}</span>
              <span className={cn("mt-0.5 text-[0.5625rem] tabular-nums", isSelected ? "text-on-primary" : lunar.strong ? "font-bold text-danger" : "text-muted")}>{lunar.text}</span>
              {busy ? <span aria-hidden className={cn("absolute bottom-0.5 size-1 rounded-full", isSelected ? "bg-on-primary" : "bg-primary")} /> : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
