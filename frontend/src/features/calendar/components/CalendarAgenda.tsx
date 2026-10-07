"use client";

import type { Member } from "@/core/model/member";
import type { OccurrenceState } from "@/core/model/occurrence";
import type { LocalDate } from "@/core/time/local-date";
import { EventCard } from "@/design/components";
import { cn } from "@/design/cn";
import { useItemEditor, type OccurrenceEntry } from "@/features/items";
import { MemberAvatar } from "@/features/members";
import { blockTimeLabel } from "@/features/today";
import { t } from "@/i18n/vi";
import { shortDateVi, weekdayCode } from "../model/calendar-entries";

/** Phone layout (< 768px) for day and week: the hour grid becomes a list grouped by day, empty days skipped. */
export function CalendarAgenda({
  days,
  byDay,
  today,
  states,
  memberById,
}: {
  days: LocalDate[];
  byDay: Map<LocalDate, OccurrenceEntry[]>;
  today: LocalDate;
  states: Map<string, OccurrenceState>;
  memberById: Map<string, Member>;
}) {
  const openDetail = useItemEditor((s) => s.openDetail);
  const filled = days.filter((d) => (byDay.get(d)?.length ?? 0) > 0);
  return (
    <div className="flex flex-col gap-4 p-3" data-testid="calendar-agenda">
      {filled.map((d) => (
        <section key={d} aria-labelledby={`agenda-${d}`}>
          <h3 id={`agenda-${d}`} className={cn("mb-2 flex items-center gap-2 text-sm font-bold", d === today ? "text-primary" : "text-text")}>
            {t("calendar.agendaDay", { weekday: t(`calendar.weekdayHeader.${weekdayCode(d)}`), date: shortDateVi(d) })}
            {d === today ? <span className="rounded-chip bg-primary-soft px-2 py-0.5 text-xs">{t("calendar.todayBadge")}</span> : null}
          </h3>
          <ul className="flex flex-col gap-2">
            {(byDay.get(d) ?? []).map(({ item, occurrence }) => {
              const people = item.memberIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m);
              return (
                <li key={occurrence.occurrenceKey}>
                  <EventCard
                    title={occurrence.title ?? item.title}
                    timeLabel={occurrence.allDay ? t("calendar.allDay") : blockTimeLabel({ occurrence })}
                    category={item.category}
                    className={states.get(occurrence.occurrenceKey)?.status === "DONE" ? "opacity-60" : undefined}
                    onClick={() => openDetail(item.id, occurrence.occurrenceKey)}
                    trailing={
                      people.length > 0 ? (
                        <span className="flex shrink-0 -space-x-2" title={people.map((m) => m.displayName).join(", ")}>
                          {people.slice(0, 3).map((m) => (
                            <MemberAvatar key={m.id} name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="xs" ring />
                          ))}
                          <span className="sr-only">{people.map((m) => m.displayName).join(", ")}</span>
                        </span>
                      ) : undefined
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
