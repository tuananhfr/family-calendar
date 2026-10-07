import type { ReactNode } from "react";
import { cn } from "../cn";
import { Card } from "./Card";

export interface StatCardProps {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  sublabel?: string;
  /** Category token pair used for the icon tile, e.g. "study". */
  tone?: string;
  className?: string;
}

export function StatCard({ icon, value, label, sublabel, tone = "study", className }: StatCardProps) {
  return (
    <Card className={cn("flex min-w-0 items-center gap-3 !p-3 md:!p-4", className)}>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-control md:size-11 [&_svg]:size-5"
        style={{ background: `var(--cat-${tone}-bg)`, color: `var(--cat-${tone}-dot)` }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight tabular-nums text-text">{value}</p>
        <p className="line-clamp-2 text-xs leading-snug text-body" title={label}>
          {label}
        </p>
        {sublabel ? (
          <p className="truncate text-xs text-muted" title={sublabel}>
            {sublabel}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
