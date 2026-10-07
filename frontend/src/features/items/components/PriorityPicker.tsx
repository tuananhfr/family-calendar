"use client";

import { PRIORITIES, PRIORITY_META, type Priority } from "@/design/categories";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";

const SELECTED = { danger: "border-danger bg-danger-soft", warning: "border-warning bg-warning-soft", success: "border-success bg-success-soft" } as const;
const ICON = { danger: "text-danger", warning: "text-warning", success: "text-success" } as const;

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id="item-priority" className="text-sm font-semibold text-text">
        {t("items.fields.priority")}
      </span>
      <div role="radiogroup" aria-labelledby="item-priority" className="flex flex-wrap gap-2">
        {PRIORITIES.map((p) => {
          const meta = PRIORITY_META[p];
          const Icon = meta.icon;
          const on = value === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(p)}
              className={cn(
                "flex min-h-[var(--touch-min)] flex-1 basis-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-control border px-3 text-sm font-medium text-text transition-colors",
                on ? SELECTED[meta.tone] : "border-border bg-surface hover:border-primary",
              )}
            >
              <Icon aria-hidden className={cn("size-4 shrink-0", ICON[meta.tone])} />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
