"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3, Bell, CalendarDays, Check, ChevronLeft, ChevronRight, UsersRound } from "lucide-react";
import { db } from "@/core/db/db";
import { canReadItem, hasLevel } from "@/core/access/evaluate";
import { isSpecialDayPreset } from "@/core/model/common";
import { expandOccurrences } from "@/core/recurrence/expand";
import { addDays, isLocalDate } from "@/core/time/local-date";
import { Button, Card, ErrorState, ForbiddenState, PageHeader, ProgressBar, Select, SkeletonList, StatCard, Tabs, TextField } from "@/design/components";
import { useActiveSpace, useSpaceToday } from "@/features/members";
import { useLocalProjection } from "@/features/projection/hooks/useLocalProjection";
import { formatVnd } from "@/features/finance/model/money";
import { t, vi } from "@/i18n/vi";
import { periodWindow, reportForPeriod, type ReportPeriod } from "../model/report-period";
import { familySuggestions } from "../model/suggestions";
import { periodDetails } from "../model/period-details";
import { ReportCharts } from "./ReportCharts";

export function ReportsScreen() {
  const projection = useLocalProjection();
  const { space, data, access } = projection;
  const { spaces, setActive } = useActiveSpace();
  const today = useSpaceToday();
  const [date, setDate] = useState<string>();
  const selectedDate = date ?? today;
  const [period, setPeriod] = useState<ReportPeriod>("MONTH");
  const [tab, setTab] = useState("overview");
  const extra = useLiveQuery(async () => space ? { savings: await db.financeSavings.where("spaceId").equals(space.id).toArray(), goals: await db.financeGoals.where("spaceId").equals(space.id).toArray(), metrics: await db.healthMetrics.where("spaceId").equals(space.id).toArray() } : null, [space?.id]);
  const weekStartsOn = space?.settings.weekStartsOn;
  const window = useMemo(() => periodWindow(selectedDate, period, weekStartsOn), [selectedDate, period, weekStartsOn]);
  const report = useMemo(() => data && access ? reportForPeriod(data, selectedDate, period, access, today) : undefined, [data, access, selectedDate, period, today]);
  const detail = useMemo(() => data && access && extra ? periodDetails(data, window, access, extra) : undefined, [data, access, extra, window]);
  const upcoming = useMemo(() => data && access ? data.items.filter((item) => isSpecialDayPreset(item.preset) && canReadItem(access, item)).flatMap((item) => expandOccurrences(item.id, item.schedule, { from: today, to: addDays(today, 30) }, data.exceptions.filter((row) => row.itemId === item.id)).map((occurrence) => ({ title: occurrence.title ?? item.title, date: occurrence.start.slice(0, 10), key: occurrence.occurrenceKey }))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8) : [], [data, access, today]);
  const step = (direction: number) => { if (period === "WEEK") setDate(addDays(selectedDate, direction * 7)); else { const [year, month] = selectedDate.split("-").map(Number); const value = year * 12 + month - 1 + direction; setDate(`${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, "0")}-01`); } };
  return <div className="flex flex-col gap-5"><PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} icon={<BarChart3 />} illustration="corner-reports" />
    <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4"><Select label={t("reports.space")} value={space?.id} onValueChange={setActive} options={spaces.map((candidate) => ({ value: candidate.id, label: candidate.name }))} /><Select label={t("reports.period")} value={period} onValueChange={(value) => setPeriod(value as ReportPeriod)} options={[{ value: "MONTH", label: t("reports.month") }, { value: "WEEK", label: t("reports.week") }]} /><TextField type="date" label={t("reports.selectedDate")} value={selectedDate} onChange={(e) => { if (isLocalDate(e.target.value)) setDate(e.target.value); }} /><div className="flex items-center justify-between gap-2"><Button variant="secondary" aria-label={t("reports.previous")} onClick={() => step(-1)}><ChevronLeft aria-hidden className="size-4" /></Button><span className="text-sm font-semibold text-text">{period === "MONTH" ? selectedDate.slice(0, 7) : `${window.from.slice(5)} – ${window.to.slice(5)}`}</span><Button variant="secondary" aria-label={t("reports.next")} onClick={() => step(1)}><ChevronRight aria-hidden className="size-4" /></Button></div></div>
    <Tabs label={t("reports.title")} value={tab} onValueChange={setTab} items={Object.keys(vi.reports.tabs).map((value) => ({ value, label: t(`reports.tabs.${value}`) }))} />
    <p className="text-sm text-muted">{t("reports.localHint")}</p>
    {projection.error ? <ErrorState /> : projection.denied ? <ForbiddenState /> : projection.loading || !report || !detail ? <SkeletonList rows={3} /> : <>
      <div data-testid="report-kpis" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label={t("reports.events")} value={report.events.count} icon={<CalendarDays />} sublabel={report.events.deltaPercent === null ? t("reports.noPrevious") : t("reports.vsPrevious", { n: report.events.deltaPercent })} /><StatCard label={t("reports.completed")} value={`${report.tasks.done}/${report.tasks.total}`} icon={<Check />} sublabel={`${report.tasks.percent}%`} tone="activity" /><StatCard label={t("reports.reminderCount")} value={report.reminders.count} icon={<Bell />} tone="finance" /><StatCard label={t("reports.activeMembers")} value={`${report.members.active}/${report.members.total}`} icon={<UsersRound />} tone="family" /></div>
      {["overview", "calendar", "members"].includes(tab) && <ReportCharts report={report} categories={tab !== "members"} members />}
      {["overview", "tasks"].includes(tab) && <Card className="flex flex-col gap-3"><h2 className="font-bold text-text">{t("reports.tabs.tasks")}</h2><p className="text-sm text-body">{t("reports.doneOfTotal", { done: report.tasks.done, total: report.tasks.total })}</p><ProgressBar value={report.tasks.percent} label={t("reports.progress")} /></Card>}
      {["overview", "habits"].includes(tab) && <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("reports.habits")}</h2>{report.habits.length ? report.habits.map((habit) => <div key={habit.itemId}><p className="mb-2 break-words text-sm font-semibold text-text">{habit.title} · {habit.done}/{habit.total}</p><ProgressBar value={habit.percent} label={habit.title} /></div>) : <p className="text-sm text-muted">{t("reports.noData")}</p>}</Card>}
      {["overview", "calendar"].includes(tab) && <Card className="flex flex-col gap-3"><h2 className="font-bold text-text">{t("reports.topEvents")}</h2><ul className="flex flex-col gap-2">{report.topEvents.map((event) => <li key={event.title} className="flex justify-between gap-3 text-sm text-body"><span className="min-w-0 break-words">{event.title}</span><span className="shrink-0">{t("reports.occurrences", { n: event.count })}</span></li>)}</ul>{!report.topEvents.length && <p className="text-sm text-muted">{t("reports.noData")}</p>}</Card>}
      {tab === "finance" && (access && hasLevel(access, "finance") ? <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("reports.finances")}</h2><dl className="grid gap-4 sm:grid-cols-2">{(["income", "expense", "saved", "remaining"] as const).map((key) => <div key={key}><dt className="text-sm text-muted">{t(`reports.${key}`)}</dt><dd className="break-words text-xl font-bold text-text">{formatVnd(detail[key])}</dd></div>)}</dl></Card> : <ForbiddenState />)}
      {tab === "health" && (access && hasLevel(access, "health") ? <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("reports.tabs.health")}</h2><p className="text-xs text-muted">{t("health.disclaimer")}</p><dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-sm text-muted">{t("reports.healthMetrics")}</dt><dd className="text-xl font-bold text-text">{detail.metrics}</dd></div><div><dt className="text-sm text-muted">{t("reports.healthNotes")}</dt><dd className="text-xl font-bold text-text">{detail.notes}</dd></div><div><dt className="text-sm text-muted">{t("reports.medicationDone")}</dt><dd className="text-xl font-bold text-text">{detail.medicationDone}/{detail.medicationTotal}</dd></div></dl><p className="text-xs text-muted">{t("reports.medicationHint")}</p></Card> : <ForbiddenState />)}
      {tab === "overview" && <div className="grid gap-4 lg:grid-cols-2"><Card className="flex flex-col gap-3"><h2 className="font-bold text-text">{t("reports.upcoming")}</h2>{upcoming.length ? <ul className="flex flex-col gap-2">{upcoming.map((event) => <li key={event.key} className="text-sm text-body">{event.date} · {event.title}</li>)}</ul> : <p className="text-sm text-muted">{t("reports.upcomingEmpty")}</p>}</Card><Card className="flex flex-col gap-3"><h2 className="font-bold text-text">{t("reports.suggestions")}</h2><ul className="flex flex-col gap-3">{familySuggestions(report, t(period === "MONTH" ? "reports.periodMonth" : "reports.periodWeek")).map((suggestion) => <li key={suggestion} className="text-sm text-body">{suggestion}</li>)}</ul></Card></div>}
    </>}
  </div>;
}
