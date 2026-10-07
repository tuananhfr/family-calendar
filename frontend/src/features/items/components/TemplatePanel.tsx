"use client";

import { CATEGORY_META } from "@/design/categories";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import { SYSTEM_TEMPLATES, type TemplateDef } from "../model/templates";

/** "Mẫu gợi ý nhanh" (IMG-B): picking one fills the form, nothing is saved until "Lưu". */
export function TemplatePanel({ onPick, className }: { onPick: (t: TemplateDef) => void; className?: string }) {
  return (
    <section aria-labelledby="item-templates" className={cn("rounded-card border border-border bg-surface p-3", className)}>
      <h3 id="item-templates" className="px-1 pb-2 text-sm font-bold text-text">
        {t("items.templates.panelTitle")}
      </h3>
      <ul className="flex flex-col divide-y divide-border">
        {SYSTEM_TEMPLATES.map((tpl) => {
          const meta = CATEGORY_META[tpl.category];
          const Icon = meta.icon;
          return (
            <li key={tpl.key}>
              <button type="button" onClick={() => onPick(tpl)} className="flex min-h-11 w-full items-center gap-2.5 rounded-control px-1 py-1.5 text-left text-sm text-text hover:bg-primary-soft">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-control" style={{ background: `var(${meta.bgVar})` }}>
                  <Icon className="size-4" style={{ color: `var(${meta.dotVar})` }} />
                </span>
                <span className="line-clamp-2 min-w-0 flex-1">{tpl.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
