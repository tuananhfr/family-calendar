"use client";

import { useMemo, useState } from "react";
import { Cake, Plus } from "lucide-react";
import type { SpecialDayPreset } from "@/core/model/common";
import { datePart } from "@/core/time/zoned";
import { Button, Card, EmptyState, PageHeader, SkeletonList, Tabs } from "@/design/components";
import { formatDateVi, useItemEditor, useOccurrences } from "@/features/items";
import { useActiveSpace, useMembers, useSpaceToday } from "@/features/members";
import { t } from "@/i18n/vi";
import { specialDayList, specialDayOccurrenceKey } from "../model/special-day-list";
import { SPECIAL_KIND_ORDER } from "./kind-icons";
import { SpecialDayCard } from "./SpecialDayCard";

type Tab = "ALL" | SpecialDayPreset;
const MONTH_DAYS = 30;

/** `/ngay-dac-biet`: every special day by its next date, lunar ones resolved to this year's solar date. */
export function SpecialDaysPage() {
  const today = useSpaceToday();
  const { space } = useActiveSpace();
  const members = useMembers(space?.id);
  // Items only: the countdown finds each next date itself, lunar rules included.
  const occ = useOccurrences(null);
  const { openCreate, openDetail } = useItemEditor();
  const [tab, setTab] = useState<Tab>("ALL");
  const memberById = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members]);
  const list = useMemo(() => specialDayList(tab === "ALL" ? occ.items : occ.items.filter((i) => i.preset === tab), today), [occ.items, tab, today]);
  const loading = occ.loading || members === undefined;
  const [first, ...rest] = list.upcoming;
  const inMonth = list.upcoming.filter((r) => r.countdown.daysLeft <= MONTH_DAYS).length;
  const add = () => openCreate({ type: "SPECIAL", initial: tab === "ALL" ? undefined : { preset: tab, calendarSystem: tab === "DEATH_ANNIVERSARY" ? "LUNAR" : "SOLAR" } });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("specialDays.title")}
        subtitle={t("specialDays.subtitle")}
        icon={<Cake />}
        illustration="corner-add"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={add}>
            {t("specialDays.add")}
          </Button>
        }
      />
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Tabs
            label={t("specialDays.tabsLabel")}
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
            items={(["ALL", ...SPECIAL_KIND_ORDER] as const).map((x) => ({ value: x, label: t(`specialDays.tabs.${x}`) }))}
            className="max-w-full"
          />
          {!loading && inMonth > 0 ? <p className="text-sm font-medium text-muted">{t("specialDays.inMonth", { n: inMonth })}</p> : null}
        </div>
        {loading ? (
          <SkeletonList rows={4} />
        ) : !first && list.past.length === 0 ? (
          <EmptyState
            title={tab === "ALL" ? t("specialDays.empty.ALL") : t("specialDays.empty.tab")}
            body={t("specialDays.empty.body")}
            illustration="corner-add"
            action={
              <Button icon={<Plus className="size-4" />} onClick={add}>
                {t("specialDays.add")}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {first ? <SpecialDayCard row={first} memberById={memberById} featured /> : null}
            {rest.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {rest.map((row) => (
                  <li key={row.item.id} className="flex min-w-0">
                    <SpecialDayCard row={row} memberById={memberById} />
                  </li>
                ))}
              </ul>
            ) : null}
            {list.past.length > 0 ? (
              <section aria-labelledby="special-past" className="flex flex-col gap-1 border-t border-border pt-4">
                <h2 id="special-past" className="text-sm font-bold text-text">
                  {t("specialDays.pastTitle")}
                </h2>
                <p className="text-xs text-muted">{t("specialDays.pastHint")}</p>
                <ul className="mt-1 flex flex-col">
                  {list.past.map((item) => {
                    const date = datePart(item.schedule.start);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-label={t("specialDays.open", { title: item.title })}
                          onClick={() => openDetail(item.id, specialDayOccurrenceKey(item, date))}
                          className="flex w-full min-w-0 items-center justify-between gap-3 rounded-control px-2 py-2 text-left text-sm hover:bg-primary-soft"
                        >
                          <span className="min-w-0 truncate text-body">{item.title}</span>
                          <span className="shrink-0 text-muted">{formatDateVi(date)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
