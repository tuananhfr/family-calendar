"use client";

import { parseLocalDate } from "@/core/time/local-date";
import { Card, Countdown } from "@/design/components";
import { CATEGORY_META } from "@/design/categories";
import { useItemEditor } from "@/features/items";
import { blockTimeLabel } from "@/features/today";
import { t } from "@/i18n/vi";
import type { UpcomingEvent } from "../model/calendar-entries";

/** IMG-D "Sự kiện sắp tới": the next events with a day countdown. */
export function UpcomingEventsRail({ events }: { events: UpcomingEvent[] }) {
  const openDetail = useItemEditor((s) => s.openDetail);
  return (
    <Card className="flex flex-col gap-3" aria-labelledby="calendar-upcoming" role="region">
      <h2 id="calendar-upcoming" className="text-sm font-bold text-text">
        {t("calendar.upcoming.title")}
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted">{t("calendar.upcoming.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1" data-testid="upcoming-events">
          {events.map(({ entry, date, daysLeft }) => {
            const { day, month } = parseLocalDate(date);
            const meta = CATEGORY_META[entry.item.category];
            return (
              <li key={entry.occurrence.occurrenceKey}>
                <button
                  type="button"
                  onClick={() => openDetail(entry.item.id, entry.occurrence.occurrenceKey)}
                  className="flex w-full items-center gap-3 rounded-control p-1.5 text-left hover:bg-primary-soft"
                >
                  <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-control leading-none" style={{ background: `var(${meta.bgVar})` }}>
                    <span className="text-base font-bold tabular-nums text-text">{day}</span>
                    <span className="mt-0.5 text-[0.625rem] font-semibold" style={{ color: `var(${meta.dotVar})` }}>
                      {t("calendar.monthShort", { month })}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{entry.occurrence.title ?? entry.item.title}</span>
                    <span className="block truncate text-xs text-muted">{entry.occurrence.allDay ? t("calendar.allDay") : blockTimeLabel(entry)}</span>
                  </span>
                  <Countdown days={daysLeft} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
