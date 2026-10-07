"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { CalendarPlus, ChevronLeft, ChevronRight, Ellipsis, ExternalLink, Filter, Plus, UserPlus } from "lucide-react";
import { formatLunar, solarToLunar } from "@/core/lunar/lunar";
import type { Member } from "@/core/model/member";
import { addDays, type LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";
import { ROUTES } from "@/app-shell/nav-config";
import { buttonClass, Card, EmptyState, IconButton } from "@/design/components";
import { cn } from "@/design/cn";
import { occurrenceStatesByKey, useItemEditor, type OccurrenceEntry } from "@/features/items";
import { MemberAvatar, MemberChips } from "@/features/members";
import { t } from "@/i18n/vi";
import { useAppStore } from "@/store/app.store";
import { allDayOf, columnsFor, type LayoutOptions } from "../model/day-layout";
import { boardDateVi } from "../model/date-label";
import { entriesOn } from "../hooks/useTodayData";
import { DayAgenda } from "./DayAgenda";
import { MemberColumn } from "./MemberColumn";

const PX_PER_HOUR = 44;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;
// Sized so three members + "Thêm cột" fit beside the rail at 1280px without a horizontal scroll.
const GUTTER = "3rem";
const ADD_COLUMN = "7.5rem";
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

function ViewSwitch({ date }: { date: LocalDate }) {
  const link = (view: string) => `${ROUTES.calendar}?view=${view}&date=${date}`;
  const item = "inline-flex min-h-9 items-center rounded-[8px] px-3 text-sm font-semibold";
  return (
    <nav aria-label={t("today.board.label")} className="inline-flex rounded-control bg-primary-soft p-1">
      <span aria-current="page" className={cn(item, "bg-primary text-on-primary")}>
        {t("today.board.views.day")}
      </span>
      <Link href={link("week")} className={cn(item, "text-primary hover:bg-surface")}>
        {t("today.board.views.week")}
      </Link>
      <Link href={link("month")} className={cn(item, "text-primary hover:bg-surface")}>
        {t("today.board.views.month")}
      </Link>
    </nav>
  );
}

/** "Thêm cột": brings back a member hidden by the filter; with everyone shown it points to adding a member. */
function AddColumn({ hidden, onAdd }: { hidden: Member[]; onAdd: (id: string) => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger className={cn(buttonClass("secondary", "sm"), "w-full")}>
        <Plus aria-hidden className="size-4" />
        {t("today.board.addColumn")}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-control border border-border bg-surface p-1 shadow-pop">
          {hidden.map((m) => (
            <Menu.Item
              key={m.id}
              onSelect={() => onAdd(m.id)}
              className="flex min-h-10 cursor-default items-center gap-2 rounded-[8px] px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft"
            >
              <MemberAvatar name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="xs" />
              {m.displayName}
            </Menu.Item>
          ))}
          {hidden.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted">{t("today.board.noHiddenMembers")}</p> : null}
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item asChild>
            <Link href={ROUTES.addMember} className="flex min-h-10 items-center gap-2 rounded-[8px] px-2 text-sm text-primary outline-none data-[highlighted]:bg-primary-soft">
              <UserPlus aria-hidden className="size-4" />
              {t("today.board.addMember")}
            </Link>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function DayBoard({ entries, members, states, today }: { entries: OccurrenceEntry[]; members: Member[]; states: Parameters<typeof occurrenceStatesByKey>[0]; today: LocalDate }) {
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
  const template = `${GUTTER} repeat(${columns.length}, minmax(${MIN_COLUMN}, 1fr)) ${ADD_COLUMN}`;
  const isToday = date === today;
  const lunar = formatLunar(solarToLunar(date));
  const memberById = new Map(active.map((m) => [m.id, m]));

  const addColumn = (id: string) => {
    const next = filter === "ALL" ? [id] : [...filter, id];
    setFilter(next.length >= active.length ? "ALL" : next);
  };
  const addOnDate = () => openCreate({ type: "EVENT", initial: { date } });

  return (
    <Card padded={false} className="@container flex min-w-0 flex-col" aria-label={t("today.board.label")} role="region">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 md:gap-3 md:p-4">
        <ViewSwitch date={date} />
        <div className="flex items-center gap-1">
          <IconButton label={t("today.board.prevDay")} icon={<ChevronLeft className="size-5" />} variant="outline" onClick={() => setDate(addDays(date, -1))} />
          <button
            type="button"
            onClick={() => setDate(today)}
            disabled={isToday}
            className={cn(buttonClass("secondary", "sm"), "disabled:border-border-strong disabled:bg-surface disabled:text-text")}
          >
            {t("today.board.backToToday")}
          </button>
          <IconButton label={t("today.board.nextDay")} icon={<ChevronRight className="size-5" />} variant="outline" onClick={() => setDate(addDays(date, 1))} />
        </div>
        {/* The board is narrower than the viewport beside the rail, so the toolbar follows its own width. */}
        <div className="order-last w-full text-center @3xl:order-none @3xl:w-auto @3xl:flex-1">
          <h2 className="text-base font-bold text-text" aria-live="polite" data-testid="board-date">
            {boardDateVi(date)}
          </h2>
          <p className="text-xs text-muted">{lunar}</p>
        </div>
        <div className="ml-auto flex items-center gap-1 @3xl:ml-0">
          <Popover.Root>
            <Popover.Trigger className={cn(buttonClass("secondary", "sm"), "hidden md:inline-flex")}>
              <Filter aria-hidden className="size-4" />
              {t("today.board.filter")}
              {filter !== "ALL" ? <span className="rounded-chip bg-primary px-1.5 text-xs text-on-primary">{filter.length}</span> : null}
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={6} className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-control border border-border bg-surface p-3 shadow-pop">
                <MemberChips members={members} value={filter} onChange={setFilter} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton label={t("today.board.more")} icon={<Ellipsis className="size-5" />} variant="outline" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-control border border-border bg-surface p-1 shadow-pop">
                <Menu.Item onSelect={addOnDate} className="flex min-h-10 cursor-default items-center gap-2 rounded-[8px] px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft">
                  <CalendarPlus aria-hidden className="size-4 text-primary" />
                  {t("today.board.addEvent")}
                </Menu.Item>
                <Menu.Item asChild>
                  <Link
                    href={`${ROUTES.calendar}?view=day&date=${date}`}
                    className="flex min-h-10 items-center gap-2 rounded-[8px] px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft"
                  >
                    <ExternalLink aria-hidden className="size-4 text-primary" />
                    {t("today.board.openCalendar")}
                  </Link>
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={isToday ? t("today.board.emptyTitle") : t("today.board.emptyDayTitle")}
          body={t("today.board.emptyBody")}
          illustration="corner-calendar"
          action={
            <button type="button" className={buttonClass("primary", "md")} onClick={addOnDate}>
              {t("today.board.add")}
            </button>
          }
        />
      ) : (
        <>
          <div className="md:hidden">
            <DayAgenda entries={visible} memberById={memberById} states={stateMap} />
          </div>
          <div className="hidden overflow-x-auto md:block" data-testid="member-grid">
            <div className="min-w-max">
              <div className="grid border-b border-border" style={{ gridTemplateColumns: template }}>
                <span aria-hidden />
                {columns.map((c) => (
                  <div key={c.member === "SHARED" ? "shared" : c.member.id} className="flex min-w-0 items-center justify-center gap-2 border-l border-border px-2 py-2.5">
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
                <div className="flex items-center border-l border-border px-1.5 py-2">
                  <AddColumn hidden={hidden} onAdd={addColumn} />
                </div>
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
              <div className="grid" style={{ gridTemplateColumns: template }}>
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
                <div aria-hidden className="border-l border-border" />
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
