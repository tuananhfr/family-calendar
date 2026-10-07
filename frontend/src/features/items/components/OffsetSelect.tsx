"use client";

import { Select } from "@/design/components";
import { t } from "@/i18n/vi";
import { offsetChoicesFor, offsetLabel } from "../model/offsets";

/** Picks the main offset; extra offsets from templates (e.g. "1 ngày + 2 giờ") are kept and listed below. */
export function OffsetSelect({ offsets, months, allDay, onChange, error }: { offsets: number[]; months?: number[]; allDay: boolean; onChange: (offsets: number[]) => void; error?: string }) {
  const first = offsets[0];
  const rest = offsets.slice(1);
  const extra = [...rest.map((m) => offsetLabel(m, allDay)), ...(months ?? []).map((n) => t("items.offsets.months", { n }))];
  return (
    <div data-field="reminderOffsets" data-invalid={error ? "true" : undefined}>
      <Select
        label={t("items.fields.offset")}
        value={first === undefined ? undefined : String(first)}
        onValueChange={(v) => onChange([Number(v), ...rest.filter((m) => m !== Number(v))])}
        options={offsetChoicesFor(allDay, first).map((m) => ({ value: String(m), label: offsetLabel(m, allDay) }))}
        helper={extra.length ? t("items.offsets.more", { list: extra.join(", ") }) : undefined}
        error={error}
      />
    </div>
  );
}
