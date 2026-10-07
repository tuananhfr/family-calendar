import type { LucideIcon } from "lucide-react";
import { Bell, CalendarDays, Cake, ListChecks, NotebookTabs } from "lucide-react";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import { START_OPTIONS, type StartOption } from "../model/create-family";

const META: Record<StartOption, { icon: LucideIcon; bgVar: string }> = {
  CALENDAR: { icon: CalendarDays, bgVar: "--cat-family-bg" },
  TASKS: { icon: ListChecks, bgVar: "--cat-housework-bg" },
  REMINDERS: { icon: Bell, bgVar: "--cat-health-bg" },
  TIMETABLE: { icon: NotebookTabs, bgVar: "--cat-study-bg" },
  SPECIAL_DAYS: { icon: Cake, bgVar: "--cat-special-bg" },
};

export function StepStart({ value, onChange }: { value: StartOption; onChange: (v: StartOption) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-text">{t("onboarding.start.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("onboarding.start.body")}</p>
      </div>
      <div role="radiogroup" aria-label={t("onboarding.start.title")} className="grid gap-2 sm:grid-cols-2">
        {START_OPTIONS.map((o) => {
          const { icon: Icon, bgVar } = META[o];
          const selected = value === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o)}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-card border-2 bg-surface p-3 text-left transition-colors",
                selected ? "border-primary" : "border-border hover:border-border-strong",
              )}
            >
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-control text-text" style={{ background: `var(${bgVar})` }}>
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-text">{t(`onboarding.start.options.${o}.label`)}</span>
                <span className="block text-sm text-muted">{t(`onboarding.start.options.${o}.body`)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
