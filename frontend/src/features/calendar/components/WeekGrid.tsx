"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { solarToLunar } from "@/core/lunar/lunar";
import type { OccurrenceState } from "@/core/model/occurrence";
import { parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { cn } from "@/design/cn";
import { useItemEditor, type OccurrenceEntry } from "@/features/items";
import { EventBlock, layoutDay, type LayoutOptions } from "@/features/today";
import { t } from "@/i18n/vi";
import { shortDateVi, weekdayCode } from "../model/calendar-entries";

const PX_PER_HOUR = 44;
const DEFAULT_SCROLL_HOUR = 6;
// IMG-D shows 06–21; the rest of the day is reachable by scrolling inside the grid.
const VISIBLE_HOURS = 15;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const GUTTER = "3rem";
// Seven days must fit beside the rail at 1280px; narrower than this and titles become unreadable, so it scrolls.
const MIN_DAY_COLUMN = "4.5rem";

/** Small lunar day under a solar day: '1/9' on mùng 1 so the lunar month is visible, plain day otherwise. */
export function lunarDayLabel(date: LocalDate): { text: string; strong: boolean } {
  const l = solarToLunar(date);
  return { text: l.day === 1 ? `1/${l.month}${l.leap ? "N" : ""}` : String(l.day), strong: l.day === 1 || l.day === 15 };
}

function earliestHour(days: LocalDate[], byDay: Map<LocalDate, OccurrenceEntry[]>): number {
  let hour = DEFAULT_SCROLL_HOUR;
  for (const d of days)
    for (const e of byDay.get(d) ?? []) {
      if (e.occurrence.allDay || e.occurrence.start.slice(0, 10) !== d) continue;
      hour = Math.min(hour, Number(e.occurrence.start.slice(11, 13)));
    }
  return hour;
}

/** Hour grid for 1 (day view) or 7 (week view) days; in the week view a column header opens that day. */
export function WeekGrid({
  days,
  byDay,
  today,
  states,
  onOpenDay,
}: {
  days: LocalDate[];
  byDay: Map<LocalDate, OccurrenceEntry[]>;
  today: LocalDate;
  states: Map<string, OccurrenceState>;
  onOpenDay?: (d: LocalDate) => void;
}) {
  const openDetail = useItemEditor((s) => s.openDetail);
  const scroller = useRef<HTMLDivElement>(null);
  const template = `${GUTTER} repeat(${days.length}, minmax(${days.length > 1 ? MIN_DAY_COLUMN : "0"}, 1fr))`;
  const height = 24 * PX_PER_HOUR;
  const firstDay = days[0];
  const scrollHour = earliestHour(days, byDay);

  // Land on the morning (or the earliest event) when the range changes, not on every data refresh.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, scrollHour * PX_PER_HOUR - 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDay, days.length]);

  const columns = useMemo(
    () =>
      days.map((d) => {
        const opts: LayoutOptions = { startHour: 0, endHour: 24, pxPerHour: PX_PER_HOUR, date: d };
        const entries = byDay.get(d) ?? [];
        return { date: d, allDay: entries.filter((e) => e.occurrence.allDay), blocks: layoutDay(entries, opts).map((b) => ({ ...b, span: 1 })) };
      }),
    [days, byDay],
  );
  const hasAllDay = columns.some((c) => c.allDay.length > 0);

  return (
    <div className="overflow-x-auto" data-testid="week-grid">
      <div className={days.length > 1 ? "min-w-max" : undefined}>
        <div className="grid border-b border-border" style={{ gridTemplateColumns: template }}>
          <span aria-hidden />
          {days.map((d) => {
            const { day } = parseLocalDate(d);
            const lunar = lunarDayLabel(d);
            const isToday = d === today;
            const weekday = t(`calendar.weekdayHeader.${weekdayCode(d)}`);
            const head = (
              <>
                <span className={cn("text-xs font-semibold", isToday ? "text-primary" : "text-muted")}>{weekday}</span>
                <span className={cn("flex size-8 items-center justify-center rounded-full text-base font-bold tabular-nums", isToday ? "bg-primary text-on-primary" : "text-text")}>{day}</span>
                <span className={cn("text-[0.6875rem] tabular-nums", lunar.strong ? "font-bold text-danger" : "text-muted")}>
                  <span className="sr-only">{t("calendar.lunarPrefix")} </span>
                  {lunar.text}
                </span>
              </>
            );
            return (
              <div key={d} className="border-l border-border" data-testid="day-header" aria-current={isToday ? "date" : undefined}>
                {onOpenDay ? (
                  <button
                    type="button"
                    onClick={() => onOpenDay(d)}
                    aria-label={t("calendar.openDay", { date: `${weekday} ${shortDateVi(d)}` })}
                    className="flex w-full flex-col items-center gap-0.5 py-2 hover:bg-primary-soft"
                  >
                    {head}
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-0.5 py-2">{head}</div>
                )}
              </div>
            );
          })}
        </div>
        {hasAllDay ? (
          <div className="grid border-b border-border bg-surface-2" style={{ gridTemplateColumns: template }}>
            <span className="self-center px-1 text-center text-[0.6875rem] font-semibold text-muted">{t("calendar.allDay")}</span>
            {columns.map((c) => (
              <ul key={c.date} className="flex min-w-0 flex-col gap-1 border-l border-border p-1">
                {c.allDay.map((e) => (
                  <li key={e.occurrence.occurrenceKey}>
                    <AllDayChip entry={e} onOpen={() => openDetail(e.item.id, e.occurrence.occurrenceKey)} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        ) : null}
        <div ref={scroller} className="overflow-y-auto overscroll-contain" style={{ maxHeight: VISIBLE_HOURS * PX_PER_HOUR }} data-testid="hour-scroller">
          <div className="grid" style={{ gridTemplateColumns: template }}>
            <div aria-hidden className="relative" style={{ height }}>
              {HOURS.map((h) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[0.6875rem] tabular-nums text-muted" style={{ top: h * PX_PER_HOUR + (h === 0 ? 8 : 0) }}>
                  {`${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>
            {columns.map((c) => (
              <div
                key={c.date}
                role="group"
                aria-label={shortDateVi(c.date)}
                className={cn("relative border-l border-border", c.date === today && days.length > 1 && "bg-primary-soft/40")}
                style={{
                  height,
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent ${PX_PER_HOUR}px)`,
                }}
              >
                {c.blocks.map((b) => (
                  <EventBlock
                    key={b.occurrence.occurrenceKey}
                    block={b}
                    dense={days.length > 1}
                    done={states.get(b.occurrence.occurrenceKey)?.status === "DONE"}
                    onOpen={() => openDetail(b.item.id, b.occurrence.occurrenceKey)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AllDayChip({ entry, onOpen, className }: { entry: OccurrenceEntry; onOpen: () => void; className?: string }) {
  const title = entry.occurrence.title ?? entry.item.title;
  const cat = entry.item.category.toLowerCase();
  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      data-testid="calendar-chip"
      className={cn("block w-full truncate rounded-[6px] border-l-[3px] px-1.5 py-0.5 text-left text-xs font-semibold text-text hover:shadow-card", className)}
      style={{ background: `var(--cat-${cat}-bg)`, borderLeftColor: `var(--cat-${cat}-dot)` }}
    >
      {title}
    </button>
  );
}
