import { cn } from "../cn";

export function ProgressBar({ value, label, showValue = true, colorVar = "--color-success", className }: { value: number; label: string; showValue?: boolean; colorVar?: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped)} className="h-2 min-w-0 flex-1 overflow-hidden rounded-chip bg-border">
        <div className="h-full rounded-chip transition-[width] duration-300" style={{ width: `${clamped}%`, background: `var(${colorVar})` }} />
      </div>
      {showValue ? <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-text">{Math.round(clamped)}%</span> : null}
    </div>
  );
}
