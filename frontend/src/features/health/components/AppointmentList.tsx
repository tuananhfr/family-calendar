"use client";

import { Stethoscope } from "lucide-react";
import { Badge } from "@/design/components";
import { useItemEditor } from "@/features/items";
import { t } from "@/i18n/vi";
import { vnDateTime, type AppointmentRow } from "../model/health-view";

/** Upcoming health events; a row opens the shared item detail (edit/cancel live there, not here). */
export function AppointmentList({ rows, names }: { rows: AppointmentRow[]; names: Map<string, string> }) {
  const openDetail = useItemEditor((s) => s.openDetail);
  return (
    <ul className="flex flex-col divide-y divide-border" data-testid="appointment-list">
      {rows.map((row) => {
        const title = row.occurrence.title ?? row.item.title;
        const who = row.item.memberIds
          .map((id) => names.get(id))
          .filter(Boolean)
          .join(", ");
        return (
          <li key={row.occurrence.occurrenceKey}>
            <button
              type="button"
              onClick={() => openDetail(row.item.id, row.occurrence.occurrenceKey)}
              aria-label={t("health.appointments.open", { title })}
              className="flex w-full min-w-0 items-center gap-3 rounded-control py-3 text-left hover:bg-surface-2"
              data-testid="appointment-row"
            >
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--cat-activity-bg)] text-[var(--cat-activity-dot)] [&_svg]:size-5">
                <Stethoscope />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text">{who ? `${who} - ${title}` : title}</span>
                <span className="block truncate text-xs tabular-nums text-muted">{vnDateTime(row.occurrence.start)}</span>
              </span>
              <Badge tone={row.daysLeft === 0 ? "warning" : "success"} className="shrink-0 whitespace-nowrap">
                {row.daysLeft === 0 ? t("health.appointments.today") : t("health.appointments.daysLeft", { n: row.daysLeft })}
              </Badge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
