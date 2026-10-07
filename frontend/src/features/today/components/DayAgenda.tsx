"use client";

import type { Member } from "@/core/model/member";
import type { OccurrenceState } from "@/core/model/occurrence";
import { EventCard } from "@/design/components";
import { useItemEditor, type OccurrenceEntry } from "@/features/items";
import { MemberAvatar } from "@/features/members";
import { t } from "@/i18n/vi";
import { blockTimeLabel } from "./EventBlock";

/** Mobile replacement for the member grid (ui-ux.md < 768px): one card per occurrence, all-day first. */
export function DayAgenda({ entries, memberById, states }: { entries: OccurrenceEntry[]; memberById: Map<string, Member>; states: Map<string, OccurrenceState> }) {
  const openDetail = useItemEditor((s) => s.openDetail);
  const ordered = [...entries.filter((e) => e.occurrence.allDay), ...entries.filter((e) => !e.occurrence.allDay)];
  return (
    <ul className="flex flex-col gap-2 p-3" data-testid="day-agenda">
      {ordered.map(({ item, occurrence }) => {
        const people = item.memberIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m);
        const done = states.get(occurrence.occurrenceKey)?.status === "DONE";
        return (
          <li key={occurrence.occurrenceKey}>
            <EventCard
              title={occurrence.title ?? item.title}
              timeLabel={occurrence.allDay ? t("today.board.allDay") : blockTimeLabel({ occurrence })}
              category={item.category}
              className={done ? "opacity-60" : undefined}
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
  );
}
