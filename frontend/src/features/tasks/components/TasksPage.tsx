"use client";

import { useMemo, useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { Button, Card, DataTable, EmptyState, Illustration, PageHeader, PriorityTag, ScriptText, SkeletonList, type Column } from "@/design/components";
import { useItemEditor } from "@/features/items";
import { t } from "@/i18n/vi";
import { useTaskList } from "../hooks/useTaskList";
import { filterTasks, type TaskTab, type TaskView } from "../model/task-filters";
import { applyTaskFilters } from "../model/task-rows";
import { TaskActionsMenu, TaskAssignee, TaskDue, TaskMobileCard, TaskStatusCell, TaskTitleCell, useTaskToggle } from "./TaskRow";
import { TaskFilterMenu, TaskTabs, type TaskFilterValue } from "./TaskTabs";

/** `/viec` (IMG-D): eight tabs, status/priority filter, table on desktop and cards on phones. */
export function TasksPage() {
  const list = useTaskList();
  const openCreate = useItemEditor((s) => s.openCreate);
  const toggle = useTaskToggle();
  const [tab, setTab] = useState<TaskTab>("ALL");
  const [filters, setFilters] = useState<TaskFilterValue>({ status: "ALL", priority: "ALL" });
  const memberById = useMemo(() => new Map(list.members.map((m) => [m.id, m])), [list.members]);
  const rows = useMemo(() => applyTaskFilters(filterTasks(list.rows, tab, list.ctx), filters, list.today), [list.rows, list.ctx, tab, filters, list.today]);
  const filtered = filters.status !== "ALL" || filters.priority !== "ALL";

  const add = () => openCreate({ type: "TASK", initial: { date: list.today } });
  const columns: Column<TaskView>[] = [
    { key: "task", header: t("tasks.columns.task"), render: (r) => <TaskTitleCell row={r} onToggle={toggle} /> },
    { key: "assignee", header: t("tasks.columns.assignee"), className: "w-[22%]", render: (r) => <TaskAssignee row={r} memberById={memberById} /> },
    { key: "due", header: t("tasks.columns.due"), className: "w-28", render: (r) => <TaskDue row={r} today={list.today} /> },
    { key: "priority", header: t("tasks.columns.priority"), className: "w-32", render: (r) => <PriorityTag priority={r.item.priority} /> },
    { key: "status", header: t("tasks.columns.status"), className: "w-32", render: (r) => <TaskStatusCell row={r} today={list.today} /> },
    { key: "actions", header: t("tasks.columns.actions"), srOnlyHeader: true, className: "w-16 text-right", render: (r) => <TaskActionsMenu row={r} /> },
  ];

  const emptyTitle = filtered ? t("tasks.empty.filtered") : tab === "ALL" ? t("tasks.empty.ALL") : t("tasks.empty.tab");
  const emptyBody = tab === "MINE" && !list.ctx.usingMemberId ? t("tasks.mineHint") : tab === "CHILDREN" ? t("tasks.childrenHint") : t("tasks.empty.body");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("tasks.title")}
        subtitle={t("tasks.subtitle")}
        icon={<ListChecks />}
        actions={
          <>
            <TaskFilterMenu value={filters} onChange={setFilters} />
            <Button icon={<Plus className="size-4" />} onClick={add}>
              {t("tasks.add")}
            </Button>
          </>
        }
      />
      <Card className="flex flex-col gap-4">
        <TaskTabs value={tab} onChange={setTab} />
        {list.loading ? (
          <SkeletonList rows={5} />
        ) : (
          <DataTable
            caption={t("tasks.title")}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.occurrence.occurrenceKey}
            minWidth="42rem"
            stackBelow="lg"
            mobileCard={(r) => <TaskMobileCard row={r} today={list.today} memberById={memberById} onToggle={toggle} />}
            empty={
              <EmptyState
                title={emptyTitle}
                body={emptyBody}
                illustration="corner-tasks"
                action={
                  <Button icon={<Plus className="size-4" />} onClick={add}>
                    {t("tasks.add")}
                  </Button>
                }
              />
            }
          />
        )}
      </Card>
      {/* The crop has a light paper background that glares on the dark theme; it is decoration, so dark hides it. */}
      <div aria-hidden className="dark:hidden">
        <div className="hidden items-end justify-center gap-6 md:flex">
          <Illustration name="footer-tasks" height={150} />
          <div className="hidden lg:block">
            <ScriptText>{t("tasks.script")}</ScriptText>
          </div>
        </div>
      </div>
    </div>
  );
}
