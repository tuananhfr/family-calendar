"use client";

import { useMemo, useState } from "react";
import { Bell, Plus } from "lucide-react";
import { Button, Card, DataTable, EmptyState, PageHeader, SkeletonList, Tabs, type Column } from "@/design/components";
import { useItemEditor } from "@/features/items";
import { t } from "@/i18n/vi";
import { useReminderList, type ReminderRow } from "../hooks/useReminderList";
import { REMINDER_TABS, reminderTabOf, type ReminderTab } from "../model/reminder-filters";
import { QuickReminder } from "./QuickReminder";
import { ReminderActionsMenu, ReminderMobileCard, ReminderRecipients, ReminderRepeat, ReminderTime, ReminderTitle, ReminderToggle } from "./ReminderRow";

/** `/nhac` (IMG-D): seven tabs, one row per reminder with its on/off switch, and the "Nhắc nhanh" bar. */
export function RemindersPage() {
  const list = useReminderList();
  const openCreate = useItemEditor((s) => s.openCreate);
  const [tab, setTab] = useState<ReminderTab>("ALL");
  const memberById = useMemo(() => new Map(list.members.map((m) => [m.id, m])), [list.members]);
  const rows = useMemo(() => (tab === "ALL" ? list.rows : list.rows.filter((r) => reminderTabOf(r.item) === tab)), [list.rows, tab]);
  const add = () => openCreate({ type: "REMINDER" });

  const columns: Column<ReminderRow>[] = [
    { key: "content", header: t("reminders.columns.content"), render: (r) => <ReminderTitle row={r} /> },
    { key: "time", header: t("reminders.columns.time"), className: "w-40", render: (r) => <ReminderTime row={r} /> },
    { key: "repeat", header: t("reminders.columns.repeat"), className: "w-44", render: (r) => <ReminderRepeat row={r} /> },
    { key: "recipients", header: t("reminders.columns.recipients"), className: "w-[20%]", render: (r) => <ReminderRecipients row={r} memberById={memberById} /> },
    { key: "status", header: t("reminders.columns.status"), className: "w-24", render: (r) => <ReminderToggle row={r} /> },
    { key: "actions", header: t("reminders.columns.actions"), srOnlyHeader: true, className: "w-16 text-right", render: (r) => <ReminderActionsMenu row={r} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("reminders.title")}
        subtitle={t("reminders.subtitle")}
        icon={<Bell />}
        illustration="corner-reminders"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={add}>
            {t("reminders.add")}
          </Button>
        }
      />
      <Card className="flex flex-col gap-4">
        <Tabs label={t("reminders.tabsLabel")} value={tab} onValueChange={(v) => setTab(v as ReminderTab)} items={REMINDER_TABS.map((x) => ({ value: x, label: t(`reminders.tabs.${x}`) }))} />
        {list.loading ? (
          <SkeletonList rows={5} />
        ) : (
          <DataTable
            caption={t("reminders.title")}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.item.id}
            minWidth="42rem"
            stackBelow="lg"
            mobileCard={(r) => <ReminderMobileCard row={r} memberById={memberById} />}
            empty={<EmptyState title={tab === "ALL" ? t("reminders.empty.ALL") : t("reminders.empty.tab")} body={t("reminders.empty.body")} illustration="corner-reminders" />}
          />
        )}
      </Card>
      <QuickReminder />
    </div>
  );
}
