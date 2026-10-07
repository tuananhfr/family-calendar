"use client";

import { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Copy, FileUp, Plus } from "lucide-react";
import { addDays, type LocalDate } from "@/core/time/local-date";
import { CATEGORY_META } from "@/design/categories";
import { cn } from "@/design/cn";
import { Button, Card, IconButton, LegendDot, PageHeader, SkeletonList, Tabs } from "@/design/components";
import { weekRangeLabel } from "@/features/calendar";
import { formatDateVi, useItemEditor } from "@/features/items";
import { useActiveSpace, useSpaceToday } from "@/features/members";
import { t } from "@/i18n/vi";
import { useTimetable } from "../hooks/useTimetable";
import { TIMETABLE_TABS, type TimetableTab } from "../model/timetable-filter";
import { CopyWeekDialog } from "./CopyWeekDialog";
import { ImportDialog } from "./ImportDialog";
import { MemberPicker } from "./MemberPicker";
import { TimetableGrid } from "./TimetableGrid";
import { TimetableReport } from "./TimetableReport";

const LEGEND = ["STUDY", "ACTIVITY", "SPORT", "FAMILY", "OTHER"] as const;

/** `/thoi-khoa-bieu` (IMG-F): week grid of TIMETABLE lessons, per-day/member/category views, copy week and CSV/XLSX import. */
export function TimetablePage() {
  const today = useSpaceToday();
  const { space } = useActiveSpace();
  const weekStartsOn = space?.settings.weekStartsOn ?? 1;
  const openCreate = useItemEditor((s) => s.openCreate);
  const [tab, setTab] = useState<TimetableTab>("WEEK");
  const [date, setDate] = useState<LocalDate | null>(null);
  const [memberPick, setMemberPick] = useState<string>();
  const [dialog, setDialog] = useState<"import" | "copy" | null>(null);
  const shown = date ?? today;
  const view = useTimetable(shown, tab, memberPick);

  const isDay = tab === "DAY";
  const step = (dir: 1 | -1) => setDate(addDays(shown, dir * (isDay ? 1 : 7)));
  const isCurrent = isDay ? shown === today : view.week.from <= today && today <= view.week.to;
  const label = isDay ? formatDateVi(shown) : t("timetable.week", { range: weekRangeLabel(view.week) });
  const add = () => openCreate({ type: "EVENT", initial: { preset: "TIMETABLE", category: "STUDY", date: isCurrent && !isDay ? today : isDay ? shown : view.week.from } });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("timetable.title")}
        subtitle={t("timetable.subtitle")}
        icon={<BookOpen />}
        illustration="corner-timetable"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={add}>
            {t("timetable.add")}
          </Button>
        }
      />
      <Card padded={false} className="flex min-w-0 flex-col">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:p-5">
          <Tabs label={t("timetable.tabsLabel")} value={tab} onValueChange={(v) => setTab(v as TimetableTab)} items={TIMETABLE_TABS.map((x) => ({ value: x, label: t(`timetable.tabs.${x}`) }))} />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <IconButton label={t(isDay ? "timetable.prevDay" : "timetable.prevWeek")} icon={<ChevronLeft className="size-5" />} onClick={() => step(-1)} />
              <p className="min-w-0 px-1 text-base font-bold text-text tabular-nums" aria-live="polite" data-testid="timetable-range">
                {label}
              </p>
              <IconButton label={t(isDay ? "timetable.nextDay" : "timetable.nextWeek")} icon={<ChevronRight className="size-5" />} onClick={() => step(1)} />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDate(null)} disabled={isCurrent} className={cn(isCurrent && "opacity-60")}>
              {t("timetable.today")}
            </Button>
            {/* Both read the loaded week and members; opened earlier, an import would match names against nobody. */}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<Copy className="size-4" />} onClick={() => setDialog("copy")} disabled={view.loading}>
                {t("timetable.copy.open")}
              </Button>
              <Button variant="secondary" size="sm" icon={<FileUp className="size-4" />} onClick={() => setDialog("import")} disabled={view.loading}>
                {t("timetable.import.open")}
              </Button>
            </div>
          </div>
          {tab === "MEMBER" ? <MemberPicker members={view.members} value={view.memberId} onChange={setMemberPick} /> : null}
        </div>
        {view.loading ? (
          <div className="p-5">
            <SkeletonList rows={6} />
          </div>
        ) : tab === "REPORT" ? (
          <TimetableReport lessons={view.lessons} week={view.week} members={view.members} />
        ) : (
          <TimetableGrid days={isDay ? [shown] : view.week.days} byDay={view.byDay} today={today} states={view.states} members={view.members} onAdd={add} onImport={() => setDialog("import")} />
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border px-4 py-3" aria-label={t("timetable.legend")} role="group">
          {LEGEND.map((c) => (
            <LegendDot key={c} colorVar={CATEGORY_META[c].dotVar} label={t(`timetable.categories.${c}`)} />
          ))}
        </div>
      </Card>
      {/* Mounted only while open so each opening starts from the week now on screen. */}
      {dialog === "import" ? <ImportDialog open onOpenChange={(o) => setDialog(o ? "import" : null)} members={view.members} defaultWeek={view.week.from} weekStartsOn={weekStartsOn} /> : null}
      {dialog === "copy" ? <CopyWeekDialog open onOpenChange={(o) => setDialog(o ? "copy" : null)} week={view.week} items={view.items} weekStartsOn={weekStartsOn} /> : null}
    </div>
  );
}
