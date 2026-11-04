"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Smartphone } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { Card, Skeleton, SkeletonList } from "@/design/components";
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
    <div role="status" aria-label={t("common.loading")} className="flex flex-col gap-5 md:gap-6">
      <Skeleton className="h-24 w-full max-w-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Card>
        <SkeletonList rows={5} />
      </Card>
    </div>
  );
}

/** Today: greeting, six counters, member day board and supporting rails; Senior devices get the short version. */
export function TodayScreen() {
  const now = useClock();
  const data = useTodayData(now);
  const senior = useAppStore((s) => s.seniorMode);
  const today = data.header.today;
  const todayEntries = useMemo(() => entriesOn(data.entries, today), [data.entries, today]);
  const states = useMemo(() => data.entries.flatMap((e) => (e.state ? [e.state] : [])), [data.entries]);

  if (data.loading) return <TodaySkeleton />;
  if (senior) return <SeniorToday header={data.header} entries={todayEntries} />;

  return (
    <div className="flex flex-col gap-4">
      <Greeting header={data.header} />
      <TodayStats stats={data.stats} />
      <Link href={ROUTES.screenTime} className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 text-text shadow-sm hover:bg-primary-soft">
        <span className="rounded-control bg-primary-soft p-2 text-primary"><Smartphone aria-hidden className="size-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-bold">Thời gian màn hình</span><span className="block text-sm text-muted">Xem thời gian sử dụng điện thoại và mục tiêu mỗi ngày.</span></span><ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_21rem]">
        <DayBoard key={today} entries={data.entries} members={data.members} states={states} today={today} nowTime={data.header.time} />
        <aside className="grid content-start items-start gap-4 md:grid-cols-2 xl:grid-cols-1">
          <TasksTodayRail tasks={data.tasksToday} today={today} nowTime={data.header.time} />
          <HealthRemindersRail rows={data.health} />
          <DueSoonRail rows={data.dueSoon} />
          <UpcomingDaysRail rows={data.specialDays} />
        </aside>
      </div>
    </div>
  );
}
