"use client";

import { useMemo } from "react";
import { Card, Skeleton, SkeletonList } from "@/design/components";
import { MemberChips } from "@/features/members";
import { t } from "@/i18n/vi";
import { useAppStore } from "@/store/app.store";
import { useClock } from "../hooks/useClock";
import { entriesOn, useTodayData } from "../hooks/useTodayData";
import { DayBoard } from "./DayBoard";
import { DueSoonRail } from "./DueSoonRail";
import { Greeting } from "./Greeting";
import { HealthRemindersRail } from "./HealthRemindersRail";
import { SeniorToday } from "./SeniorToday";
import { TasksTodayRail } from "./TasksTodayRail";
import { TodayStats } from "./TodayStats";
import { UpcomingDaysRail } from "./UpcomingDaysRail";

function TodaySkeleton() {
  return (
    <div role="status" aria-label={t("common.loading")} className="flex flex-col gap-5">
      <Skeleton className="h-24 w-full max-w-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[4.5rem]" />
        ))}
      </div>
      <Card>
        <SkeletonList rows={5} />
      </Card>
    </div>
  );
}

/** Today: greeting, six counters, member day board and four rails; Senior devices get the short version. */
export function TodayScreen() {
  const now = useClock();
  const data = useTodayData(now);
  const senior = useAppStore((s) => s.seniorMode);
  const filter = useAppStore((s) => s.memberFilter);
  const setFilter = useAppStore((s) => s.setMemberFilter);
  const today = data.header.today;
  const todayEntries = useMemo(() => entriesOn(data.entries, today), [data.entries, today]);
  const states = useMemo(() => data.entries.flatMap((e) => (e.state ? [e.state] : [])), [data.entries]);

  if (data.loading) return <TodaySkeleton />;
  if (senior) return <SeniorToday header={data.header} entries={todayEntries} />;

  return (
    <div className="flex flex-col gap-5">
      <Greeting header={data.header} />
      {data.members.length > 0 ? (
        <div className="md:hidden">
          <MemberChips members={data.members} value={filter} onChange={setFilter} />
        </div>
      ) : null}
      <TodayStats stats={data.stats} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <DayBoard key={today} entries={data.entries} members={data.members} states={states} today={today} />
        <aside className="grid content-start items-start gap-4 md:grid-cols-2 xl:grid-cols-1">
          <TasksTodayRail tasks={data.tasksToday} today={today} nowTime={data.header.time} />
          <UpcomingDaysRail rows={data.specialDays} />
          <HealthRemindersRail rows={data.health} />
          <DueSoonRail rows={data.dueSoon} />
        </aside>
      </div>
    </div>
  );
}
