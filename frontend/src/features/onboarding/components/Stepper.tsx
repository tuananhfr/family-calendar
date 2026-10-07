import { Check } from "lucide-react";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";

export function Stepper({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label={t("onboarding.stepOf", { n: step + 1 })}>
      {[0, 1, 2].map((i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={i} aria-current={current ? "step" : undefined} className="flex min-w-0 flex-col gap-2">
            <span className={cn("h-1.5 rounded-chip transition-colors", done || current ? "bg-primary" : "bg-border")} />
            <span
              className={cn("flex min-w-0 items-center gap-1.5 text-xs font-semibold sm:text-sm", current ? "text-primary" : done ? "text-text" : "text-muted")}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
                  done ? "bg-primary text-on-primary" : current ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="truncate">{t(`onboarding.steps.${i}`)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
