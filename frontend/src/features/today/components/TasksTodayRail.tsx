"use client";

import { useState, type FormEvent } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import type { LocalDate } from "@/core/time/local-date";
import { timePart } from "@/core/time/zoned";
import { CategoryTag, Checkbox, IconButton, SectionCard, toast } from "@/design/components";
import { newFormValues, useItemEditor, useItemMutations } from "@/features/items";
import { useActiveSpace } from "@/features/members";
import type { TaskView } from "@/features/tasks";
import { t } from "@/i18n/vi";

/** IMG-A "Việc cần làm hôm nay": ticking writes the occurrence state, so it survives a reload and other tabs see it. */
export function TasksTodayRail({ tasks, today, nowTime }: { tasks: TaskView[]; today: LocalDate; nowTime: string }) {
  const mutations = useItemMutations();
  const { space } = useActiveSpace();
  const openDetail = useItemEditor((s) => s.openDetail);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = async (task: TaskView, done: boolean) => {
    try {
      await mutations.act(task.item.id, task.occurrence.occurrenceKey, done ? "DONE" : "UNDO");
      toast(t(done ? "today.tasks.doneToast" : "today.tasks.undoneToast"), "success", 2500);
    } catch {
      toast(t("today.actionFailed"), "error");
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || !mutations.ready) return;
    setBusy(true);
    try {
      await mutations.create({ ...newFormValues("TASK", { date: today, nowTime, spaceKind: space?.kind }), title: clean });
      setTitle("");
      toast(t("today.tasks.added", { title: clean }), "success", 2500);
    } catch {
      toast(t("today.actionFailed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title={t("today.tasks.title")} seeAllHref={ROUTES.tasks}>
      {tasks.length === 0 ? <p className="text-sm text-muted">{t("today.tasks.empty")}</p> : null}
      <ul className="flex flex-col divide-y divide-border" data-testid="tasks-today">
        {tasks.map((task) => {
          const title = task.occurrence.title ?? task.item.title;
          return (
            <li key={task.occurrence.occurrenceKey} className="flex min-w-0 items-center gap-1">
              <Checkbox
                checked={task.done}
                onCheckedChange={(v) => toggle(task, v)}
                strikeWhenChecked
                className="min-w-0 flex-1 py-1"
                label={
                  <>
                    <span className="block truncate">{title}</span>
                    {/* inline-flex is an atomic inline box, so the done strike-through stops at the title. */}
                    <span className="mt-0.5 inline-flex max-w-full items-center gap-2">
                      <CategoryTag category={task.item.category} className="max-w-[8rem]" />
                      {task.occurrence.allDay ? null : <span className="text-xs tabular-nums text-muted">{timePart(task.occurrence.start)}</span>}
                    </span>
                  </>
                }
              />
              <IconButton
                label={t("today.tasks.details", { title })}
                icon={<ChevronRight className="size-4" />}
                className="-mr-2 shrink-0"
                onClick={() => openDetail(task.item.id, task.occurrence.occurrenceKey)}
              />
            </li>
          );
        })}
      </ul>
      <form onSubmit={add} className="flex items-center gap-2 rounded-control border border-border bg-surface-2 px-2 focus-within:border-primary">
        <Plus aria-hidden className="size-4 shrink-0 text-primary" />
        <label htmlFor="today-quick-task" className="sr-only">
          {t("today.tasks.quickAddLabel")}
        </label>
        <input
          id="today-quick-task"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          // Until the Space has loaded a submit would be dropped, so typing waits for it instead.
          disabled={!mutations.ready}
          placeholder={t("today.tasks.quickAddPlaceholder")}
          className="min-h-[var(--touch-min)] min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
        />
        <button type="submit" disabled={busy || !title.trim()} className="rounded-[8px] px-2 py-1 text-sm font-semibold text-primary disabled:text-disabled-text">
          {t("common.add")}
        </button>
      </form>
    </SectionCard>
  );
}
