import { Info } from "lucide-react";
import { HEALTH_DISCLAIMER_KEY } from "@/core/model/health";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";

/** Fixed line on every health tab and the printed report (modules.md §8): records are reminders, not advice. */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p
      role="note"
      data-testid="health-disclaimer"
      className={cn("flex items-start gap-2 rounded-control bg-surface-2 px-3 py-2 text-xs text-body print:bg-transparent print:px-0 print:text-black/70", className)}
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary print:text-black/70" />
      <span>{t(HEALTH_DISCLAIMER_KEY)}</span>
    </p>
  );
}
