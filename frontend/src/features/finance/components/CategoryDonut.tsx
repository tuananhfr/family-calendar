import { t } from "@/i18n/vi";
import { categoryColor } from "../model/finance-view";
import { formatVnd } from "../model/money";
import type { CategoryShare } from "../model/month-summary";

const R = 15.915494; // circumference 100, so a percent is a dash length
const GAP = 0.6;

/** SVG donut + legend; the legend list carries the same numbers as text, so the chart itself is decorative to AT. */
export function CategoryDonut({ shares, total, monthNumber }: { shares: CategoryShare[]; total: bigint; monthNumber: number }) {
  if (shares.length === 0) return <p className="py-10 text-center text-sm text-muted">{t("finance.donut.empty")}</p>;
  const arcs = shares.map((s, i) => ({
    key: s.category,
    len: shares.length === 1 ? 100 : Math.max(0, s.percent - GAP),
    offset: shares.slice(0, i).reduce((sum, x) => sum + x.percent, 0),
    color: categoryColor(s.category),
  }));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative size-44 shrink-0 sm:size-48" data-testid="finance-donut">
        <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden>
          <circle cx="21" cy="21" r={R} fill="none" stroke="var(--color-border)" strokeWidth="5" />
          {arcs.map((a) => (
            <circle key={a.key} cx="21" cy="21" r={R} fill="none" stroke={a.color} strokeWidth="5" strokeDasharray={`${a.len} ${100 - a.len}`} strokeDashoffset={-a.offset} data-category={a.key} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[70%] text-sm font-bold leading-tight tabular-nums text-text [overflow-wrap:anywhere] sm:text-base">{formatVnd(total)}</span>
          <span className="text-xs text-muted">{t("finance.donut.center", { month: monthNumber })}</span>
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-2.5" aria-label={t("finance.donut.label")} data-testid="finance-legend">
        {shares.map((s) => (
          <li key={s.category} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 text-sm">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: categoryColor(s.category) }} />
            <span className="truncate text-body">{t(`finance.categories.${s.category}`)}</span>
            <span className="w-12 text-right tabular-nums text-muted">{String(s.percent).replace(".", ",")}%</span>
            <span className="min-w-[6.5rem] text-right font-semibold tabular-nums text-text">{formatVnd(s.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
