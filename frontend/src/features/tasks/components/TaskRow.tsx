"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, Ellipsis, Eye, Pencil, Repeat } from "lucide-react";
import { PRIORITIES, type Priority } from "@/core/model/common";
import type { Member } from "@/core/model/member";
import type { LocalDate } from "@/core/time/local-date";
import { CATEGORY_META, PRIORITY_META } from "@/design/categories";
import { Checkbox, IconButton, PriorityTag, StatusTag, toast } from "@/design/components";
import { cn } from "@/design/cn";
import { useItemEditor, useItemMutations } from "@/features/items";
import { AssigneeLabel } from "@/features/members";
import { t } from "@/i18n/vi";
import { setTaskPriority } from "../model/task-actions";
import { dueLabel, taskStatus, type TaskView } from "../model/task-filters";

const menuItem = "flex min-h-10 cursor-default items-center gap-2 rounded-[8px] px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft";

function titleOf(row: TaskView): string {
  return row.occurrence.title ?? row.item.title;
}

export function useTaskToggle() {
  const { act } = useItemMutations();
  return async (row: TaskView, done: boolean) => {
    try {
      await act(row.item.id, row.occurrence.occurrenceKey, done ? "DONE" : "UNDO");
      toast(t(done ? "tasks.doneToast" : "tasks.undoneToast", { title: titleOf(row) }), "success", 2500);
    } catch {
      toast(t("tasks.failed"), "error");
    }
  };
}

/** Checkbox + category icon + title; a repeat mark tells that ticking only closes this occurrence. */
export function TaskTitleCell({ row, onToggle }: { row: TaskView; onToggle: (row: TaskView, done: boolean) => void }) {
  const meta = CATEGORY_META[row.item.category];
  const Icon = meta.icon;
  const recurring = !!row.item.schedule.rrule || !!row.item.schedule.lunarRule;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Checkbox
        checked={row.done}
        onCheckedChange={(v) => onToggle(row, v)}
        strikeWhenChecked
        className="min-w-0 flex-1"
        label={
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-[8px]" style={{ background: `var(${meta.bgVar})` }}>
              <Icon className="size-4" style={{ color: `var(${meta.dotVar})` }} />
            </span>
            <span className="min-w-0 truncate font-medium text-text" title={titleOf(row)}>
              {titleOf(row)}
            </span>
          </span>
        }
      />
      {recurring ? (
        <span title={t("tasks.repeats")} className="shrink-0 text-muted">
          <Repeat aria-hidden className="size-3.5" />
          <span className="sr-only">{t("tasks.repeats")}</span>
        </span>
      ) : null}
    </div>
  );
}

export function TaskDue({ row, today }: { row: TaskView; today: LocalDate }) {
  const overdue = taskStatus(row, today) === "OVERDUE";
  return <span className={cn("whitespace-nowrap text-sm tabular-nums", overdue ? "font-semibold text-danger" : "text-body")}>{dueLabel(row.due, today)}</span>;
}

export function TaskStatusCell({ row, today }: { row: TaskView; today: LocalDate }) {
  return <StatusTag status={taskStatus(row, today)} />;
}

export function TaskAssignee({ row, memberById }: { row: TaskView; memberById: Map<string, Member> }) {
  const ids = row.item.responsibleMemberId ? [row.item.responsibleMemberId, ...row.item.memberIds.filter((id) => id !== row.item.responsibleMemberId)] : row.item.memberIds;
  const people = ids.map((id) => memberById.get(id)).filter((m): m is Member => !!m);
  return <AssigneeLabel members={people} everyone={t("tasks.everyone")} />;
}

/** ⋮: details (delete lives there, with the this/following/all question), edit, and a direct priority switch. */
export function TaskActionsMenu({ row }: { row: TaskView }) {
  const { openDetail, openEdit } = useItemEditor();
  const change = async (p: Priority) => {
    try {
      await setTaskPriority(row.item.id, p);
      toast(t("tasks.priorityToast", { priority: PRIORITY_META[p].label }), "success", 2500);
    } catch {
      toast(t("tasks.failed"), "error");
    }
  };
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton label={t("tasks.menu.label", { title: titleOf(row) })} icon={<Ellipsis className="size-5" />} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={4} className="z-50 min-w-52 rounded-control border border-border bg-surface p-1 shadow-pop">
          <Menu.Item className={menuItem} onSelect={() => openDetail(row.item.id, row.occurrence.occurrenceKey)}>
            <Eye aria-hidden className="size-4 text-primary" />
            {t("tasks.menu.details")}
          </Menu.Item>
          <Menu.Item className={menuItem} onSelect={() => openEdit(row.item.id, row.occurrence.occurrenceKey)}>
            <Pencil aria-hidden className="size-4 text-primary" />
            {t("tasks.menu.edit")}
          </Menu.Item>
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Label className="px-2 py-1 text-xs font-semibold text-muted">{t("tasks.menu.priority")}</Menu.Label>
          <Menu.RadioGroup value={row.item.priority} onValueChange={(v) => void change(v as Priority)}>
            {PRIORITIES.map((p) => (
              <Menu.RadioItem key={p} value={p} className={menuItem}>
                <span className="flex size-4 items-center justify-center">
                  <Menu.ItemIndicator>
                    <Check aria-hidden className="size-4 text-primary" />
                  </Menu.ItemIndicator>
                </span>
                {PRIORITY_META[p].label}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Phone card (< 768px): title row with the menu, then due · assignee and the two tags. */
export function TaskMobileCard({ row, today, memberById, onToggle }: { row: TaskView; today: LocalDate; memberById: Map<string, Member>; onToggle: (row: TaskView, done: boolean) => void }) {
  return (
    <div className="flex flex-col gap-2" data-testid="task-card">
      <div className="flex min-w-0 items-center gap-1">
        <TaskTitleCell row={row} onToggle={onToggle} />
        <TaskActionsMenu row={row} />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 pl-1">
        <TaskDue row={row} today={today} />
        <span aria-hidden className="text-muted">·</span>
        <TaskAssignee row={row} memberById={memberById} />
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-1">
        <PriorityTag priority={row.item.priority} />
        <TaskStatusCell row={row} today={today} />
      </div>
    </div>
  );
}
