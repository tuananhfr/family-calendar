"use client";

import { cn } from "@/design/cn";
import { Select } from "@/design/components";
import { t } from "@/i18n/vi";
import { WEEKDAY_CODES, type RepeatKind, type RepeatPreset } from "../model/repeat-presets";

const MONDAY_FIRST = [...WEEKDAY_CODES.slice(1), WEEKDAY_CODES[0]];
const GENERAL: RepeatKind[] = ["NONE", "DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY", "YEARLY"];
const SPECIAL: RepeatKind[] = ["NONE", "YEARLY", "MONTHLY"];

/** Lunar repeats are shown as Hằng năm/Hằng tháng; the "Theo lịch" switch decides solar vs lunar. */
function displayKind(kind: RepeatKind): RepeatKind {
  if (kind === "LUNAR_YEARLY") return "YEARLY";
  if (kind === "LUNAR_MONTHLY") return "MONTHLY";
  return kind;
}

export function RepeatPicker({ value, onChange, special, error }: { value: RepeatPreset; onChange: (r: RepeatPreset) => void; special?: boolean; error?: string }) {
  const kind = displayKind(value.kind);
  const kinds = [...(special ? SPECIAL : GENERAL)];
  if (kind === "CUSTOM") kinds.push("CUSTOM");
  const days = value.byDay ?? [];
  return (
    <div data-field="repeat" data-invalid={error ? "true" : undefined} className="flex min-w-0 flex-col gap-2">
      <Select
        label={t("items.fields.repeat")}
        value={kind}
        onValueChange={(v) => onChange(v === "CUSTOM" ? value : { kind: v as RepeatKind, includeLeap: value.includeLeap })}
        options={kinds.map((k) => ({ value: k, label: t(`items.repeat.${k}`) }))}
        error={error}
      />
      {kind === "WEEKLY" ? (
        <div role="group" aria-label={t("items.fields.repeatDays")} className="flex flex-wrap gap-1.5">
          {MONDAY_FIRST.map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={t(`items.weekdaysLong.${d}`)}
                onClick={() => onChange({ ...value, kind: "WEEKLY", byDay: on ? days.filter((x) => x !== d) : [...days, d] })}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  on ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-body hover:border-primary",
                )}
              >
                {t(`items.weekdays.${d}`)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
