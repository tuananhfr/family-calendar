"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Ellipsis, Eye, Pencil } from "lucide-react";
import type { Member } from "@/core/model/member";
import { occurrenceKey } from "@/core/recurrence/occurrence-key";
import { CATEGORY_META } from "@/design/categories";
import { IconButton, Switch, toast } from "@/design/components";
import { useItemEditor } from "@/features/items";
import { AssigneeLabel } from "@/features/members";
import { t } from "@/i18n/vi";
import type { ReminderRow as Row } from "../hooks/useReminderList";
import { setReminderEnabled } from "../model/reminder-filters";
import { repeatLabel } from "../model/repeat-label";
import { reminderTimeLabel } from "../model/reminder-time";

const menuItem = "flex min-h-10 cursor-default items-center gap-2 rounded-[8px] px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft";

export function ReminderTitle({ row }: { row: Row }) {
  const meta = CATEGORY_META[row.item.category];
  const Icon = meta.icon;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-[8px]" style={{ background: `var(${meta.bgVar})` }}>
        <Icon className="size-4" style={{ color: `var(${meta.dotVar})` }} />
      </span>
      <span className="min-w-0 truncate font-medium text-text" title={row.item.title}>
        {row.item.title}
      </span>
    </span>
  );
}

export function ReminderTime({ row }: { row: Row }) {
  return <span className="whitespace-nowrap text-sm tabular-nums text-body">{reminderTimeLabel(row.item.schedule)}</span>;
}

export function ReminderRepeat({ row }: { row: Row }) {
  return <span className="text-sm text-body">{repeatLabel(row.item.schedule)}</span>;
}

export function ReminderRecipients({ row, memberById }: { row: Row; memberById: Map<string, Member> }) {
  const people = row.item.memberIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m);
  return <AssigneeLabel members={people} everyone={t("reminders.everyone")} />;
}

/** The switch turns every rule of the item off; the item itself stays on the calendar. */
export function ReminderToggle({ row }: { row: Row }) {
  const toggle = async (on: boolean) => {
    try {
      for (const rule of row.rules) await setReminderEnabled(rule.id, on);
      toast(t(on ? "reminders.on" : "reminders.off", { title: row.item.title }), "success", 2500);
    } catch {
      toast(t("reminders.failed"), "error");
    }
  };
  return <Switch hideLabel label={t("reminders.toggle", { title: row.item.title })} checked={row.enabled} onCheckedChange={(v) => void toggle(v)} />;
}

export function ReminderActionsMenu({ row }: { row: Row }) {
  const { openDetail, openEdit } = useItemEditor();
  const firstKey = occurrenceKey(row.item.id, row.item.schedule.start);
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton label={t("reminders.menu.label", { title: row.item.title })} icon={<Ellipsis className="size-5" />} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-control border border-border bg-surface p-1 shadow-pop">
          <Menu.Item className={menuItem} onSelect={() => openDetail(row.item.id, firstKey)}>
            <Eye aria-hidden className="size-4 text-primary" />
            {t("reminders.menu.details")}
          </Menu.Item>
          <Menu.Item className={menuItem} onSelect={() => openEdit(row.item.id)}>
            <Pencil aria-hidden className="size-4 text-primary" />
            {t("reminders.menu.edit")}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function ReminderMobileCard({ row, memberById }: { row: Row; memberById: Map<string, Member> }) {
  return (
    <div className="flex flex-col gap-2" data-testid="reminder-card">
      <div className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 flex-1">
          <ReminderTitle row={row} />
        </span>
        <ReminderToggle row={row} />
        <ReminderActionsMenu row={row} />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 pl-9 text-sm">
        <ReminderTime row={row} />
        <span aria-hidden className="text-muted">·</span>
        <ReminderRepeat row={row} />
      </div>
      <div className="pl-9">
        <ReminderRecipients row={row} memberById={memberById} />
      </div>
    </div>
  );
}
