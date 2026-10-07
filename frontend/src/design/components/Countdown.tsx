import { cn } from "../cn";
import { countdownLabel } from "../countdown";

/** Days remaining until an occurrence; urgent (≤3 days) switches to the warning tone. */
export function Countdown({ days, className }: { days: number; className?: string }) {
  const urgent = days <= 3;
  return (
    <span className={cn("shrink-0 whitespace-nowrap text-xs font-semibold", urgent ? "text-warning" : "text-success", className)}>{countdownLabel(days)}</span>
  );
}
