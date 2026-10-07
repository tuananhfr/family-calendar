import { cn } from "../cn";

export function LegendDot({ colorVar, label, value, className }: { colorVar: string; label: string; value?: string; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2 text-sm", className)}>
      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: `var(${colorVar})` }} />
      <span className="min-w-0 flex-1 truncate text-body" title={label}>
        {label}
      </span>
      {value ? <span className="shrink-0 font-semibold tabular-nums text-text">{value}</span> : null}
    </span>
  );
}
