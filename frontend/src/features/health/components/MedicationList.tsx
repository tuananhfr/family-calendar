"use client";

import { useState } from "react";
import { AlarmClock, CircleAlert, CircleCheck, Clock, Pill, SkipForward, Undo2 } from "lucide-react";
import { timePart } from "@/core/time/zoned";
import { Badge, Button, IconButton, toast } from "@/design/components";
import type { Tone } from "@/design/tones";
import { actOnOccurrence, type OccurrenceAction } from "@/features/items";
import { t } from "@/i18n/vi";
import type { MedicationStatus } from "../model/medication-status";
import type { MedicationRow } from "../model/health-view";

const STATUS: Record<MedicationStatus, { tone: Tone; icon: typeof Clock }> = {
  TAKEN: { tone: "success", icon: CircleCheck },
  DUE_SOON: { tone: "warning", icon: AlarmClock },
  NOT_YET: { tone: "neutral", icon: Clock },
  MISSED: { tone: "danger", icon: CircleAlert },
  SKIPPED: { tone: "neutral", icon: SkipForward },
};

export function MedicationBadge({ status }: { status: MedicationStatus }) {
  const { tone, icon: Icon } = STATUS[status];
  return (
    <Badge tone={tone} icon={<Icon aria-hidden className="size-3.5" />} className="whitespace-nowrap">
      {t(`health.meds.status.${status}`)}
    </Badge>
  );
}

const DONE_TOAST: Record<Exclude<OccurrenceAction, "SNOOZE">, string> = { DONE: "taken", SKIP: "skipped", UNDO: "undone" };

function MedicationItem({ row, names, canEdit, compact }: { row: MedicationRow; names: Map<string, string>; canEdit: boolean; compact?: boolean }) {
  const [busy, setBusy] = useState<OccurrenceAction | null>(null);
  const title = row.occurrence.title ?? row.item.title;
  const who = row.item.memberIds
    .map((id) => names.get(id))
    .filter(Boolean)
    .join(", ");
  const settled = row.status === "TAKEN" || row.status === "SKIPPED";

  const act = async (action: Exclude<OccurrenceAction, "SNOOZE">) => {
    setBusy(action);
    try {
      await actOnOccurrence(row.item.id, row.occurrence.occurrenceKey, action);
      toast(t(`health.meds.${DONE_TOAST[action]}`), "success");
    } catch (e) {
      console.error(e);
      toast(t("health.meds.failed"), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 py-3" data-testid="medication-row" data-status={row.status}>
      <span
        aria-hidden
        className={`flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5 ${row.status === "TAKEN" ? "bg-success-soft text-success" : "bg-[var(--cat-health-bg)] text-[var(--cat-health-dot)]"}`}
      >
        {row.status === "TAKEN" ? <CircleCheck /> : <Pill />}
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-semibold text-text">{who ? `${who} - ${title}` : title}</p>
        <p className="text-xs tabular-nums text-muted">{row.occurrence.allDay ? t("calendar.allDay") : timePart(row.occurrence.start)}</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <MedicationBadge status={row.status} />
        {canEdit && !compact ? (
          settled ? (
            <IconButton label={t("health.meds.undoLabel", { title })} icon={<Undo2 className="size-4" />} variant="ghost" onClick={() => void act("UNDO")} disabled={busy !== null} />
          ) : (
            <>
              <Button
                size="sm"
                icon={<CircleCheck className="size-4" />}
                onClick={() => void act("DONE")}
                loading={busy === "DONE"}
                disabled={busy !== null}
                aria-label={t("health.meds.takeLabel", { title })}
              >
                {t("health.meds.take")}
              </Button>
              <IconButton label={t("health.meds.skipLabel", { title })} icon={<SkipForward className="size-4" />} variant="ghost" onClick={() => void act("SKIP")} disabled={busy !== null} />
            </>
          )
        ) : null}
      </div>
    </li>
  );
}

/** Today's doses; `compact` (overview) shows status only, the "Lịch uống thuốc" tab adds the actions. */
export function MedicationList({ rows, names, canEdit, compact }: { rows: MedicationRow[]; names: Map<string, string>; canEdit: boolean; compact?: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-border" data-testid="medication-list">
      {rows.map((row) => (
        <MedicationItem key={row.occurrence.occurrenceKey} row={row} names={names} canEdit={canEdit} compact={compact} />
      ))}
    </ul>
  );
}
