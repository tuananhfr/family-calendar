"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { DEFAULT_TIME_ZONE } from "@/core/model/common";
import { formatLunar, solarToLunar } from "@/core/lunar/lunar";
import { addDays, daysInMonth, formatLocalDate, parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { instantToZoned } from "@/core/time/zoned";
import { Button, Card, EmptyState, PageHeader, Skeleton, SkeletonList, buttonClass } from "@/design/components";
import { occurrenceStatesByKey, useItemEditor, useOccurrences } from "@/features/items";
import { MemberChips, useActiveSpace, useMembers } from "@/features/members";
import { boardDateVi, useClock } from "@/features/today";
import { t } from "@/i18n/vi";
import { useAppStore } from "@/store/app.store";
import { useCalendarParams, type CalendarView } from "../hooks/useCalendarParams";
import { calendarEntries, entriesByDay, upcomingEvents } from "../model/calendar-entries";
import { monthMatrix, monthTitle, shiftMonth } from "../model/month-matrix";
import { weekRange, weekRangeLabel } from "../model/week-range";
import { CalendarAgenda } from "./CalendarAgenda";
import { CalendarToolbar } from "./CalendarToolbar";
import { DayView } from "./DayView";
import { MiniMonth } from "./MiniMonth";
import { MonthGrid } from "./MonthGrid";
import { UpcomingEventsRail } from "./UpcomingEventsRail";
import { WeekGrid } from "./WeekGrid";

const UPCOMING_DAYS = 60;
const UPCOMING_LIMIT = 5;

function monthOf(d: LocalDate): { year: number; month: number } {
  const { year, month } = parseLocalDate(d);
  return { year, month };
}

function matrixBounds(m: { year: number; month: number }, weekStartsOn: 0 | 1): { from: LocalDate; to: LocalDate } {
  const rows = monthMatrix(m.year, m.month, weekStartsOn);
  return { from: rows[0][0].date, to: rows[5][6].date };
}

/** Same day of month in the shifted month, clamped (31/10 → 30/11). */
function shiftDateByMonth(d: LocalDate, delta: number): LocalDate {
  const { year, month, day } = parseLocalDate(d);
  const next = shiftMonth(year, month, delta);
  return formatLocalDate(next.year, next.month, Math.min(day, daysInMonth(next.year, next.month)));
}

function CalendarSkeleton() {
  return (
    <div role="status" aria-label={t("common.loading")} className="flex flex-col gap-5">
      <Skeleton className="h-16 w-full max-w-xl" />
      <Card>
        <SkeletonList rows={6} />
      </Card>
    </div>
  );
}

/** `/lich` (IMG-D): week by default (UX-003), day and month on the same URL; mini month + upcoming rail beside it. */
export function CalendarScreen() {
  const { view, date, today, set } = useCalendarParams();
  const { space } = useActiveSpace();
  const members = useMembers(space?.id);
  const weekStartsOn = space?.settings.weekStartsOn ?? 1;
  const filter = useAppStore((s) => s.memberFilter);
  const setFilter = useAppStore((s) => s.setMemberFilter);
  const openCreate = useItemEditor((s) => s.openCreate);
  const now = useClock();
  const nowTime = instantToZoned(now, space?.timeZone ?? DEFAULT_TIME_ZONE).slice(11, 16);

  // The mini month can browse away from the shown range; it snaps back whenever the anchor date moves.
  const [miniShift, setMiniShift] = useState({ anchor: date, delta: 0 });
  const delta = miniShift.anchor === date ? miniShift.delta : 0;
  const mini = shiftMonth(monthOf(date).year, monthOf(date).month, delta);

  const week = useMemo(() => weekRange(date, weekStartsOn), [date, weekStartsOn]);
  const window = useMemo(() => {
    const a = matrixBounds(monthOf(date), weekStartsOn);
    const b = matrixBounds(mini, weekStartsOn);
    const upcomingEnd = addDays(today, UPCOMING_DAYS);
    const from = [a.from, b.from, today].sort()[0];
    const to = [a.to, b.to, upcomingEnd].sort()[2];
    return { from, to };
  }, [date, mini, today, weekStartsOn]);
  const occ = useOccurrences(window);

  const visible = useMemo(() => calendarEntries(occ.entries, filter), [occ.entries, filter]);
  const byDay = useMemo(() => entriesByDay(visible, window.from, window.to), [visible, window]);
  const stateMap = useMemo(() => occurrenceStatesByKey(occ.states), [occ.states]);
  const busyDays = useMemo(() => new Set(byDay.keys()), [byDay]);
  const upcoming = useMemo(() => upcomingEvents(visible, today, nowTime, UPCOMING_LIMIT), [visible, today, nowTime]);
  const memberById = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members]);

  if (occ.loading || members === undefined) return <CalendarSkeleton />;

  const shownDays = view === "day" ? [date] : week.days;
  const shownCount = view === "month" ? 0 : shownDays.reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0);
  const { year, month } = monthOf(date);
  const header = (() => {
    if (view === "day") return { title: boardDateVi(date), subtitle: formatLunar(solarToLunar(date)), current: date === today };
    if (view === "week") return { title: monthTitle(year, month), subtitle: weekRangeLabel(week), current: week.from <= today && today <= week.to };
    return { title: monthTitle(year, month), subtitle: undefined, current: today.slice(0, 7) === date.slice(0, 7) };
  })();
  const step = (dir: 1 | -1) => set((cur) => ({ date: cur.view === "day" ? addDays(cur.date, dir) : cur.view === "week" ? addDays(cur.date, dir * 7) : shiftDateByMonth(cur.date, dir) }));
  const openDay = (d: LocalDate) => set({ view: "day", date: d });
  // In the current week/month a new event defaults to today rather than the anchor date.
  const addOnDate = () => openCreate({ type: "EVENT", initial: { date: view !== "day" && header.current ? today : date } });
  const changeView = (v: CalendarView) => set({ view: v });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle")}
        illustration="corner-calendar"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={addOnDate}>
            {t("calendar.addOnDay")}
          </Button>
        }
      />
      {members.length > 0 ? (
        <div className="md:hidden">
          <MemberChips members={members} value={filter} onChange={setFilter} />
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card padded={false} className="flex min-w-0 flex-col" role="region" aria-label={t("calendar.title")}>
          <CalendarToolbar
            view={view}
            title={header.title}
            subtitle={header.subtitle}
            isCurrent={header.current}
            members={members}
            onToday={() => set({ date: today })}
            onStep={step}
            onView={changeView}
          />
          {view === "month" ? (
            <MonthGrid year={year} month={month} weekStartsOn={weekStartsOn} byDay={byDay} today={today} onOpenDay={openDay} />
          ) : (
            <>
              <div className="hidden md:block">
                {view === "day" ? (
                  <DayView date={date} byDay={byDay} today={today} states={stateMap} />
                ) : (
                  <WeekGrid days={week.days} byDay={byDay} today={today} states={stateMap} onOpenDay={openDay} />
                )}
              </div>
              <div className="md:hidden">
                {shownCount > 0 ? (
                  <CalendarAgenda days={shownDays} byDay={byDay} today={today} states={stateMap} memberById={memberById} />
                ) : (
                  <EmptyState
                    title={t(`calendar.empty.${view}`)}
                    body={t("calendar.empty.body")}
                    illustration="corner-calendar"
                    action={
                      <button type="button" className={buttonClass("primary", "md")} onClick={addOnDate}>
                        {t("calendar.empty.add")}
                      </button>
                    }
                  />
                )}
              </div>
            </>
          )}
        </Card>
        <aside className="grid content-start items-start gap-4 md:grid-cols-2 xl:grid-cols-1">
          <MiniMonth
            shown={mini}
            selected={date}
            today={today}
            weekStartsOn={weekStartsOn}
            busyDays={busyDays}
            onShift={(d) => setMiniShift({ anchor: date, delta: delta + d })}
            onPick={(d) => set({ date: d })}
          />
          <UpcomingEventsRail events={upcoming} />
        </aside>
      </div>
    </div>
  );
}
