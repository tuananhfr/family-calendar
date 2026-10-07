import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";

/**
 * IMG-F KPI tile. `higherIsBetter` decides the delta colour: more income is good, more spending is not,
 * so the arrow alone never carries the meaning (the sign and words do too).
 */
export function KpiCard({
  label,
  value,
  delta,
  tone,
  icon,
  higherIsBetter = true,
  hint,
  testId,
}: {
  label: string;
  value: string;
  delta: number | null;
  tone: string;
  icon: ReactNode;
  higherIsBetter?: boolean;
  hint?: string;
  testId?: string;
}) {
  const good = delta === null || delta === 0 ? null : delta > 0 === higherIsBetter;
  const signed = delta === null ? "" : `${delta > 0 ? "+" : ""}${String(delta).replace(".", ",")}%`;
  return (
    <div
      className="flex min-w-0 items-start gap-3 rounded-card border border-border p-4 shadow-sm"
      style={{ background: `color-mix(in srgb, var(--cat-${tone}-bg) 45%, var(--color-surface))` }}
      data-testid={testId}
      title={hint}
    >
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-control [&_svg]:size-5" style={{ background: `var(--cat-${tone}-bg)`, color: `var(--cat-${tone}-dot)` }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-body">{label}</p>
        <p className="text-lg font-bold leading-tight tabular-nums text-text [overflow-wrap:anywhere]" data-testid={testId ? `${testId}-value` : undefined}>
          {value}
        </p>
        {delta === null ? (
          <p className="mt-0.5 text-xs text-muted">{t("finance.kpi.noPrev")}</p>
        ) : (
          <p className={cn("mt-0.5 flex items-center gap-0.5 text-xs font-semibold tabular-nums", good === null ? "text-muted" : good ? "text-success" : "text-danger")}>
            {delta > 0 ? <ArrowUp aria-hidden className="size-3.5" /> : delta < 0 ? <ArrowDown aria-hidden className="size-3.5" /> : null}
            {signed}
            {/* Four tiles at 1280–1535px leave no room for the words; screen readers still get them, as in IMG-F. */}
            <span className="xl:max-2xl:sr-only">&nbsp;{t("finance.kpi.vsPrev")}</span>
          </p>
        )}
      </div>
    </div>
  );
}
