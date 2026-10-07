"use client";

import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal } from "lucide-react";
import { PRIORITIES } from "@/core/model/common";
import { PRIORITY_META } from "@/design/categories";
import { buttonClass, Chip, Tabs } from "@/design/components";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import { TASK_TABS, type TaskTab } from "../model/task-filters";
import type { TaskPriorityFilter, TaskStatusFilter } from "../model/task-rows";

export function TaskTabs({ value, onChange }: { value: TaskTab; onChange: (v: TaskTab) => void }) {
  return <Tabs label={t("tasks.tabsLabel")} value={value} onValueChange={(v) => onChange(v as TaskTab)} items={TASK_TABS.map((tab) => ({ value: tab, label: t(`tasks.tabs.${tab}`) }))} />;
}

const STATUSES: TaskStatusFilter[] = ["ALL", "TODO", "OVERDUE", "DONE"];

export interface TaskFilterValue {
  status: TaskStatusFilter;
  priority: TaskPriorityFilter;
}

/** "Bộ lọc" (IMG-D): status and priority chips; the badge counts active filters so a narrowed list is never a surprise. */
export function TaskFilterMenu({ value, onChange }: { value: TaskFilterValue; onChange: (v: TaskFilterValue) => void }) {
  const active = Number(value.status !== "ALL") + Number(value.priority !== "ALL");
  return (
    <Popover.Root>
      <Popover.Trigger className={buttonClass("secondary", "md")}>
        <SlidersHorizontal aria-hidden className="size-4" />
        {t("tasks.filter.button")}
        {active > 0 ? <span className="rounded-chip bg-primary px-1.5 text-xs text-on-primary">{active}</span> : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-control border border-border bg-surface p-3 shadow-pop">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-semibold text-muted">{t("tasks.filter.status")}</legend>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <Chip key={s} selected={value.status === s} onClick={() => onChange({ ...value, status: s })}>
                  {s === "ALL" ? t("tasks.filter.all") : t(`tasks.filter.statuses.${s}`)}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-semibold text-muted">{t("tasks.filter.priority")}</legend>
            <div className="flex flex-wrap gap-2">
              {(["ALL", ...PRIORITIES] as TaskPriorityFilter[]).map((p) => (
                <Chip key={p} selected={value.priority === p} onClick={() => onChange({ ...value, priority: p })}>
                  {p === "ALL" ? t("tasks.filter.all") : PRIORITY_META[p].label}
                </Chip>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            disabled={active === 0}
            onClick={() => onChange({ status: "ALL", priority: "ALL" })}
            className={cn("self-end rounded-[8px] px-2 py-1 text-sm font-semibold text-primary disabled:text-disabled-text")}
          >
            {t("tasks.filter.reset")}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
