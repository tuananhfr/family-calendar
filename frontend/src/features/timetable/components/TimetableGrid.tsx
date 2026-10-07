"use client";

import { useMemo } from "react";
import { FileUp, Plus } from "lucide-react";
import type { Member } from "@/core/model/member";
import type { OccurrenceState } from "@/core/model/occurrence";
import type { LocalDate } from "@/core/time/local-date";
import { Button, EmptyState } from "@/design/components";
import { CalendarAgenda, WeekGrid } from "@/features/calendar";
import type { OccurrenceEntry } from "@/features/items";
import { t } from "@/i18n/vi";

/** Hour grid from md up, the calendar's day-by-day agenda on phones; one empty state for both. */
export function TimetableGrid({
  days,
  byDay,
  today,
  states,
  members,
  onAdd,
  onImport,
}: {
  days: LocalDate[];
  byDay: Map<LocalDate, OccurrenceEntry[]>;
  today: LocalDate;
  states: Map<string, OccurrenceState>;
  members: Member[];
  onAdd: () => void;
  onImport: () => void;
}) {
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const count = days.reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0);
  if (count === 0) {
    return (
      <EmptyState
        title={days.length === 1 ? t("timetable.empty.day") : t("timetable.empty.title")}
        body={t("timetable.empty.body")}
        illustration="corner-timetable"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={<Plus className="size-4" />} onClick={onAdd}>
              {t("timetable.add")}
            </Button>
            <Button variant="secondary" icon={<FileUp className="size-4" />} onClick={onImport}>
              {t("timetable.import.open")}
            </Button>
          </div>
        }
      />
    );
  }
  return (
    <>
      <div className="hidden md:block" data-testid="timetable-grid">
        <WeekGrid days={days} byDay={byDay} today={today} states={states} />
      </div>
      <div className="md:hidden">
        <CalendarAgenda days={days} byDay={byDay} today={today} states={states} memberById={memberById} />
      </div>
    </>
  );
}
