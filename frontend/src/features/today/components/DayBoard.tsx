"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { Member } from "@/core/model/member";
import { type LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";
import { ROUTES } from "@/app-shell/nav-config";
import { buttonClass, Card, EmptyState } from "@/design/components";
import { occurrenceStatesByKey, useItemEditor, type OccurrenceEntry } from "@/features/items";
import { MemberAvatar, MemberChips } from "@/features/members";
import { t } from "@/i18n/vi";
import { useAppStore } from "@/store/app.store";
import { allDayOf, columnsFor, type LayoutOptions } from "../model/day-layout";
import { entriesOn } from "../hooks/useTodayData";
import { DayAgenda } from "./DayAgenda";
import { MemberColumn } from "./MemberColumn";
import { DayBoardToolbar } from "./DayBoardToolbar";

const PX_PER_HOUR = 56;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;
const GUTTER = "3rem";
const MIN_COLUMN = "9rem";

/** IMG-A shows 06–21; the range widens instead of hiding an early or late event. */
function hourRange(entries: OccurrenceEntry[], date: LocalDate): Pick<LayoutOptions, "startHour" | "endHour"> {
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const { occurrence } of entries) {
    if (occurrence.allDay) continue;
    const startsToday = datePart(occurrence.start) === date;
    if (startsToday) startHour = Math.min(startHour, Number(occurrence.start.slice(11, 13)));
    else startHour = 0;
    const end = occurrence.end ?? occurrence.start;
    if (datePart(end) > date) endHour = 24;
    else endHour = Math.max(endHour, Math.ceil((Number(end.slice(11, 13)) * 60 + Number(end.slice(14, 16)) + 30) / 60));
  }
  return { startHour, endHour: Math.min(endHour, 24) };
}

function matchesFilter(entry: OccurrenceEntry, filter: string[] | "ALL"): boolean {
  return filter === "ALL" || entry.item.memberIds.length === 0 || entry.item.memberIds.some((id) => filter.includes(id));
}

export function DayBoard({ entries, members, states, today, nowTime }: { entries: OccurrenceEntry[]; members: Member[]; states: Parameters<typeof occurrenceStatesByKey>[0]; today: LocalDate; nowTime?: string }) {
  const [date, setDate] = useState(today);
  const filter = useAppStore((s) => s.memberFilter);
  const setFilter = useAppStore((s) => s.setMemberFilter);
  const openCreate = useItemEditor((s) => s.openCreate);
  const stateMap = useMemo(() => occurrenceStatesByKey(states), [states]);
  const active = useMemo(() => members.filter((m) => m.status === "ACTIVE"), [members]);

  // Tasks live in the right rail; the board shows what happens at a time (IMG-A).
  const dayEntries = useMemo(
    () => entriesOn(entries, date).filter((e) => e.item.kind !== "TASK" && e.item.showOnCalendar),
    [entries, date],
  );
  const range = useMemo(() => hourRange(dayEntries, date), [dayEntries, date]);
  const opts = useMemo<LayoutOptions>(() => ({ ...range, pxPerHour: PX_PER_HOUR, date }), [range, date]);
  const columns = useMemo(() => columnsFor(active, dayEntries, filter, opts), [active, dayEntries, filter, opts]);
  const allDay = allDayOf(dayEntries).filter((e) => matchesFilter(e, filter));
  const visible = dayEntries.filter((e) => matchesFilter(e, filter));
  const hidden = filter === "ALL" ? [] : active.filter((m) => !filter.includes(m.id));
  const hours = Array.from({ length: range.endHour - range.startHour }, (_, i) => range.startHour + i);
  const height = hours.length * PX_PER_HOUR;
  const template = `${GUTTER} repeat(${columns.length}, minmax(${MIN_COLUMN}, 1fr))`;
  const isToday = date === today;
  const currentMinutes = nowTime ? Number(nowTime.slice(0, 2)) * 60 + Number(nowTime.slice(3, 5)) : -1;
  const showNow = isToday && currentMinutes >= range.startHour * 60 && currentMinutes < range.endHour * 60;
  const memberById = new Map(active.map((m) => [m.id, m]));

  const addColumn = (id: string) => {
    const next = filter === "ALL" ? [id] : [...filter, id];
    setFilter(next.length >= active.length ? "ALL" : next);
  };
  const addOnDate = () => openCreate({ type: "EVENT", initial: { date } });

  return (
    <Card padded={false} className="@container flex min-w-0 flex-col overflow-hidden shadow-none" aria-label={t("today.board.label")} role="region">
      <DayBoardToolbar date={date} today={today} members={members} hidden={hidden} filter={filter} setFilter={setFilter} onDateChange={setDate} addColumn={addColumn} addOnDate={addOnDate} />
      {active.length > 0 ? (
        <div className="border-b border-border px-3 pt-2 pb-1 lg:hidden [&_button]:h-11">
          <MemberChips members={members} value={filter} onChange={setFilter} />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="flex min-h-80 flex-col items-center justify-center px-4 py-10 md:min-h-96">
        <span aria-hidden className="mb-2 flex size-16 items-center justify-center rounded-card bg-primary-soft text-primary"><CalendarDays className="size-8" strokeWidth={1.5} /></span>
        <EmptyState
          title={isToday ? t("today.board.emptyTitle") : t("today.board.emptyDayTitle")}
          body={t("today.board.emptyBody")}
          action={
            <button type="button" className={buttonClass("primary", "md")} onClick={addOnDate}>
              {t("today.board.add")}
            </button>
          }
        />
        </div>
      ) : (
        <>
          <div className="lg:hidden">
            <DayAgenda entries={visible} memberById={memberById} states={stateMap} />
          </div>
          <div className="hidden overflow-x-auto lg:block" data-testid="member-grid">
            <div className="min-w-max">
              <div className="grid border-b border-border" style={{ gridTemplateColumns: template }}>
                <span aria-hidden />
                {columns.map((c) => (
                  <div key={c.member === "SHARED" ? "shared" : c.member.id} className="flex min-w-0 items-center justify-center gap-2 border-l border-border bg-surface-2 px-3 py-3">
                    {c.member === "SHARED" ? (
                      <span className="truncate text-sm font-bold text-text">{t("today.board.shared")}</span>
                    ) : (
                      <>
                        <MemberAvatar name={c.member.displayName} avatar={c.member.avatar} relationship={c.member.relationship} size="sm" />
                        <span className="truncate text-sm font-bold text-text" data-testid="column-name">
                          {c.member.displayName}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {allDay.length > 0 ? (
                <div className="grid border-b border-border bg-surface-2" style={{ gridTemplateColumns: `${GUTTER} 1fr` }}>
                  <span className="self-center px-1 text-center text-[0.6875rem] font-semibold text-muted">{t("today.board.allDay")}</span>
                  <ul className="flex flex-wrap gap-1.5 border-l border-border p-2">
                    {allDay.map((e) => (
                      <AllDayChip key={e.occurrence.occurrenceKey} entry={e} memberById={memberById} />
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="relative grid" style={{ gridTemplateColumns: template }}>
                <div aria-hidden className="relative" style={{ height }}>
                  {hours.map((h, i) => (
                    <span key={h} className="absolute right-2 -translate-y-1/2 text-[0.6875rem] tabular-nums text-muted" style={{ top: i * PX_PER_HOUR + (i === 0 ? 8 : 0) }}>
                      {`${String(h).padStart(2, "0")}:00`}
                    </span>
                  ))}
                </div>
                {columns.map((c) => (
                  <MemberColumn
                    key={c.member === "SHARED" ? "shared" : c.member.id}
                    label={c.member === "SHARED" ? t("today.board.shared") : c.member.displayName}
                    blocks={c.blocks}
                    height={height}
                    pxPerHour={PX_PER_HOUR}
                    states={stateMap}
                  />
                ))}
                {showNow ? <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-primary" style={{ top: (currentMinutes / 60 - range.startHour) * PX_PER_HOUR }}><span className="absolute left-1 -translate-y-1/2 rounded bg-primary px-1 py-0.5 text-[10px] font-semibold tabular-nums text-on-primary">{nowTime}</span></div> : null}
              </div>
            </div>
          </div>
        </>
      )}
      {active.length === 0 ? (
        <p className="border-t border-border px-4 py-3 text-sm text-muted">
          {t("today.board.noMembers")}{" "}
          <Link href={ROUTES.addMember} className="font-semibold text-primary hover:underline">
            {t("today.board.addMember")}
          </Link>
        </p>
      ) : null}
    </Card>
  );
}

function AllDayChip({ entry, memberById }: { entry: OccurrenceEntry; memberById: Map<string, Member> }) {
  const openDetail = useItemEditor((s) => s.openDetail);
  const names = entry.item.memberIds.map((id) => memberById.get(id)?.displayName).filter(Boolean);
  const title = entry.occurrence.title ?? entry.item.title;
  return (
    <li>
      <button
        type="button"
        onClick={() => openDetail(entry.item.id, entry.occurrence.occurrenceKey)}
        className="inline-flex max-w-[18rem] items-center gap-1.5 rounded-chip border-l-[3px] px-2.5 py-1 text-xs font-semibold text-text hover:shadow-card"
        style={{ background: `var(--cat-${entry.item.category.toLowerCase()}-bg)`, borderLeftColor: `var(--cat-${entry.item.category.toLowerCase()}-dot)` }}
      >
        <span className="truncate">{title}</span>
        {names.length > 0 ? <span className="shrink-0 font-normal text-body">· {names.join(", ")}</span> : null}
      </button>
    </li>
  );
}
