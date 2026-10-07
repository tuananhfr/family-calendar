"use client";

import { Bell, Cake, CalendarDays, SquareCheck, type LucideIcon } from "lucide-react";
import type { Category } from "@/core/model/common";
import { CATEGORY_META } from "@/design/categories";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import { ITEM_TYPES, QUICK_CATEGORIES, type ItemType } from "../model/item-types";

export const TYPE_ICON: Record<ItemType, LucideIcon> = { EVENT: CalendarDays, TASK: SquareCheck, REMINDER: Bell, SPECIAL: Cake };
// Same tints as the mockup cards: blue calendar, blue task, amber bell, rose cake.
export const TYPE_TONE: Record<ItemType, string> = { EVENT: "study", TASK: "activity", REMINDER: "finance", SPECIAL: "health" };

/** Four type cards of "Thêm mới" (IMG-B right). */
export function TypeCards({ value, onChange }: { value: ItemType; onChange: (t: ItemType) => void }) {
  return (
    <div role="radiogroup" aria-label={t("items.typePicker")} className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {ITEM_TYPES.map((type) => {
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
              "flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border p-2.5 text-center transition-colors sm:min-h-32 sm:p-3",
              on ? "border-primary bg-primary-soft/60 ring-1 ring-primary" : "border-border bg-surface hover:border-primary",
            )}
          >
            <span aria-hidden className="flex size-10 items-center justify-center rounded-control" style={{ background: `var(--cat-${TYPE_TONE[type]}-bg)` }}>
              <Icon className="size-6" style={{ color: `var(--cat-${TYPE_TONE[type]}-dot)` }} />
            </span>
            <span className="text-sm font-bold text-text">{t(`items.types.${type}.label`)}</span>
            <span className="hidden text-xs leading-snug text-muted sm:block">{t(`items.types.${type}.body`)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Category row under the type cards; a category the row doesn't list still shows as selected nowhere. */
export function CategoryRow({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div role="radiogroup" aria-label={t("items.categoryPicker")} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {QUICK_CATEGORIES.map((c) => {
        const meta = CATEGORY_META[c];
        const Icon = meta.icon;
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c)}
            className={cn(
              "flex min-h-[var(--touch-min)] items-center justify-center gap-1.5 rounded-card border px-2 py-2 text-xs font-medium text-text transition-colors sm:flex-col sm:gap-1 sm:py-2.5 sm:text-sm",
              on ? "border-primary bg-primary-soft/60 ring-1 ring-primary" : "border-border bg-surface-2 hover:border-primary",
            )}
          >
            <Icon aria-hidden className="size-5 shrink-0 sm:size-6" style={{ color: `var(${meta.dotVar})` }} />
            <span className="truncate">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Section title above the form ("Lịch — Thêm sự kiện, lịch hẹn…"). */
export function TypeSectionHeader({ type }: { type: ItemType }) {
  const Icon = TYPE_ICON[type];
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-bold text-text">{t(`items.types.${type}.label`)}</h3>
        <p className="truncate text-sm text-muted">{t(`items.types.${type}.section`)}</p>
      </div>
    </div>
  );
}
