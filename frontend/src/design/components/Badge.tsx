import type { ReactNode } from "react";
import { cn } from "../cn";
import { TONE_SOFT, type Tone } from "../tones";

export function Badge({ children, tone = "primary", icon, className }: { children: ReactNode; tone?: Tone; icon?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 rounded-chip px-2 py-0.5 text-xs font-semibold", TONE_SOFT[tone], className)}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
