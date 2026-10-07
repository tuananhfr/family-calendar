"use client";

import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import type { ItemType } from "../model/item-types";
import { TYPE_ICON } from "./AddNewModal";

// IMG-B left: the reminder modal lists its own type first.
const ORDER: ItemType[] = ["REMINDER", "EVENT", "TASK", "SPECIAL"];

/** Pill tabs of "Thêm nhắc nhở"; switching keeps what was typed (changeType). */
export function ReminderTypeTabs({ value, onChange }: { value: ItemType; onChange: (t: ItemType) => void }) {
  return (
    <div role="radiogroup" aria-label={t("items.typePicker")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {ORDER.map((type) => {
        const Icon = TYPE_ICON[type];
        const on = value === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(type)}
            className={cn(
              "inline-flex min-h-[var(--touch-min)] shrink-0 items-center gap-2 rounded-control border px-3.5 text-sm font-semibold transition-colors",
              on ? "border-primary bg-primary text-on-primary" : "border-border bg-surface-2 text-body hover:border-primary hover:text-primary",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {t(`items.types.${type}.label`)}
          </button>
        );
      })}
    </div>
  );
}
