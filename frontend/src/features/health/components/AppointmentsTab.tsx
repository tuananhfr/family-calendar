"use client";

import { CalendarPlus } from "lucide-react";
import { Button, Card, EmptyState } from "@/design/components";
import { useItemEditor } from "@/features/items";
import { t } from "@/i18n/vi";
import type { AppointmentRow } from "../model/health-view";
import { AppointmentList } from "./AppointmentList";

export function AppointmentsTab({ rows, names, canEdit, today }: { rows: AppointmentRow[]; names: Map<string, string>; canEdit: boolean; today: string }) {
  const openCreate = useItemEditor((s) => s.openCreate);
  return (
    <Card className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-[11rem] flex-1 text-base font-bold text-text">{t("health.appointments.title")}</h2>
        {canEdit ? (
          <Button size="sm" icon={<CalendarPlus className="size-4" />} onClick={() => openCreate({ type: "EVENT", initial: { category: "HEALTH", date: today } })}>
            {t("health.appointments.add")}
          </Button>
        ) : null}
      </div>
      {rows.length === 0 ? <EmptyState title={t("health.appointments.empty")} className="py-6" /> : <AppointmentList rows={rows} names={names} />}
    </Card>
  );
}
