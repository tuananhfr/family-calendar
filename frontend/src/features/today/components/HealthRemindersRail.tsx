"use client";

import { Plus } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { timePart } from "@/core/time/zoned";
import { CATEGORY_META } from "@/design/categories";
import { Switch, toast } from "@/design/components";
import { useItemEditor } from "@/features/items";
import { repeatLabel, setReminderEnabled, type ReminderView } from "@/features/reminders";
import { t } from "@/i18n/vi";
import { TodayRail } from "./TodayRail";

/** IMG-A "Nhắc nhở sức khỏe": the switch only turns the reminder off; the item stays on the calendar. */
export function HealthRemindersRail({ rows }: { rows: ReminderView[] }) {
  const openCreate = useItemEditor((s) => s.openCreate);
  const toggle = async (row: ReminderView, on: boolean) => {
    try {
      await setReminderEnabled(row.rule.id, on);
      toast(t(on ? "today.health.on" : "today.health.off", { title: row.item.title }), "success", 2500);
    } catch {
      toast(t("today.actionFailed"), "error");
    }
  };
  return (
    <TodayRail title={t("today.health.title")} seeAllHref={ROUTES.health}>
      {rows.length === 0 ? <p className="text-sm text-muted">{t("today.health.empty")}</p> : null}
      <ul className="flex flex-col gap-1" data-testid="health-reminders">
        {rows.map((row) => {
          const meta = CATEGORY_META[row.item.category];
          const Icon = meta.icon;
          const time = row.item.schedule.allDay ? null : timePart(row.item.schedule.start);
          return (
            <li key={row.rule.id} className="flex min-w-0 items-center gap-3 rounded-control bg-surface-2 p-3">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-control" style={{ background: `var(${meta.bgVar})` }}>
                <Icon className="size-4" style={{ color: `var(${meta.dotVar})` }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text">{row.item.title}</span>
                <span className="block truncate text-xs text-muted">{[time, repeatLabel(row.item.schedule).toLowerCase()].filter(Boolean).join(" ")}</span>
              </span>
              <Switch hideLabel label={t("today.health.toggle", { title: row.item.title })} checked={row.rule.enabled !== false} onCheckedChange={(v) => void toggle(row, v)} />
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => openCreate({ type: "REMINDER", initial: { category: "HEALTH" } })}
        className="flex min-h-[var(--touch-min)] items-center gap-2 rounded-control border border-border bg-surface-2 px-3 text-sm text-primary hover:border-primary"
      >
        <Plus aria-hidden className="size-4" />
        {t("today.health.add")}
      </button>
    </TodayRail>
  );
}
