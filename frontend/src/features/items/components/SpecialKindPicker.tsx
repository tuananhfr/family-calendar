"use client";

import { SPECIAL_DAY_PRESETS, type SpecialDayPreset } from "@/core/model/common";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";

// "Khác" last: the specific kinds are what people look for first.
const ORDER: SpecialDayPreset[] = ["BIRTHDAY", "ANNIVERSARY", "DEATH_ANNIVERSARY", "HOLIDAY", "SPECIAL_DAY"];

export function SpecialKindPicker({ value, onChange }: { value: string; onChange: (p: SpecialDayPreset) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id="item-special-kind" className="text-sm font-semibold text-text">
        {t("items.fields.specialKind")}
      </span>
      <div role="radiogroup" aria-labelledby="item-special-kind" className="flex flex-wrap gap-2">
        {ORDER.filter((p) => SPECIAL_DAY_PRESETS.includes(p)).map((p) => {
          const on = value === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(p)}
              className={cn(
                "inline-flex min-h-[var(--touch-min)] items-center whitespace-nowrap rounded-chip border px-4 text-sm font-medium transition-colors",
                on ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text hover:border-primary",
              )}
            >
              {t(`items.specialKinds.${p}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
