"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import type { Member } from "@/core/model/member";
import { cn } from "@/design/cn";
import { Button, Card, EmptyState, PageHeader, SkeletonList, Tabs } from "@/design/components";
import { useItemEditor } from "@/features/items";
import { t } from "@/i18n/vi";
import { useUpcomingList } from "../hooks/useUpcomingList";
import { groupUpcoming, UPCOMING_KINDS, upcomingKindOf, type UpcomingEntry, type UpcomingGroups, type UpcomingKind } from "../model/group-upcoming";
import { UpcomingRow } from "./UpcomingRow";

type Tab = "ALL" | UpcomingKind;
type GroupKey = keyof UpcomingGroups;

const GROUPS: GroupKey[] = ["overdue", "next7", "next30", "later"];
const GROUP_TONE: Record<GroupKey, { dot: string; count: string }> = {
  overdue: { dot: "bg-danger", count: "text-danger" },
  next7: { dot: "bg-warning", count: "text-warning" },
  next30: { dot: "bg-primary", count: "text-primary" },
  later: { dot: "bg-muted", count: "text-text" },
};

/** `/sap-den-han` (v3.0): every open deadline once, grouped Quá hạn / 7 ngày tới / 30 ngày tới / Sau đó. */
export function UpcomingPage() {
  const list = useUpcomingList();
  const openCreate = useItemEditor((s) => s.openCreate);
  const [tab, setTab] = useState<Tab>("ALL");
  const memberById = useMemo(() => new Map(list.members.map((m) => [m.id, m])), [list.members]);
  const groups = useMemo(() => {
    const rows = tab === "ALL" ? list.rows : list.rows.filter((r) => upcomingKindOf(r.item) === tab);
    return groupUpcoming(rows, list.today);
  }, [list.rows, list.today, tab]);
  const total = GROUPS.reduce((n, g) => n + groups[g].length, 0);
  const add = () => openCreate({ type: "REMINDER", initial: { category: "DOCUMENT", date: list.today } });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("upcoming.title")}
        subtitle={t("upcoming.subtitle")}
        icon={<CalendarClock />}
        illustration="corner-reminders"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={add}>
            {t("upcoming.add")}
          </Button>
        }
      />
      <nav aria-label={t("upcoming.summaryLabel")} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {GROUPS.map((g) => (
          <a
            key={g}
            href={`#upcoming-${g}`}
            aria-label={t("upcoming.jumpTo", { group: t(`upcoming.groups.${g}`), n: groups[g].length })}
            className="flex min-w-0 items-center justify-between gap-2 rounded-card border border-border bg-surface px-4 py-3 shadow-sm transition-shadow hover:shadow-card"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-body">
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", GROUP_TONE[g].dot)} />
              <span className="truncate">{t(`upcoming.groups.${g}`)}</span>
            </span>
            <span className={cn("text-2xl font-bold tabular-nums", GROUP_TONE[g].count)}>{groups[g].length}</span>
          </a>
        ))}
      </nav>
      <Card className="flex flex-col gap-4">
        <Tabs label={t("upcoming.tabsLabel")} value={tab} onValueChange={(v) => setTab(v as Tab)} items={(["ALL", ...UPCOMING_KINDS] as const).map((x) => ({ value: x, label: t(`upcoming.tabs.${x}`) }))} />
        {list.loading ? (
          <SkeletonList rows={5} />
        ) : total === 0 ? (
          <EmptyState
            title={tab === "ALL" ? t("upcoming.empty.ALL") : t("upcoming.empty.tab")}
            body={t("upcoming.empty.body")}
            illustration="corner-reminders"
            action={
              <Button icon={<Plus className="size-4" />} onClick={add}>
                {t("upcoming.add")}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            {GROUPS.map((g) => (
              <UpcomingGroup key={g} group={g} rows={groups[g]} memberById={memberById} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function UpcomingGroup({ group, rows, memberById }: { group: GroupKey; rows: UpcomingEntry[]; memberById: Map<string, Member> }) {
  const headingId = `upcoming-${group}-title`;
  return (
    <section id={`upcoming-${group}`} aria-labelledby={headingId} className="scroll-mt-24" data-testid={`upcoming-group-${group}`}>
      <div className="flex items-baseline gap-2 border-b border-border pb-2">
        <span aria-hidden className={cn("size-2.5 shrink-0 self-center rounded-full", GROUP_TONE[group].dot)} />
        <h2 id={headingId} className="text-base font-bold text-text">
          {t(`upcoming.groups.${group}`)}
        </h2>
        <span className="text-sm font-semibold text-muted tabular-nums">{rows.length}</span>
        {group === "later" ? <span className="ml-auto text-xs text-muted">{t("upcoming.laterHint")}</span> : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-2 pt-3 text-sm text-muted">{t(`upcoming.groupEmpty.${group}`)}</p>
      ) : (
        <ul className="flex flex-col pt-1">
          {rows.map((e) => (
            <UpcomingRow key={e.item.id} entry={e} memberById={memberById} />
          ))}
        </ul>
      )}
    </section>
  );
}
