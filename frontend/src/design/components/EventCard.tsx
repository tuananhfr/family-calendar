import type { ReactNode } from "react";
import { cn } from "../cn";
import { CATEGORY_META, type Category } from "../categories";

export interface EventCardProps {
  title: string;
  timeLabel: string;
  category: Category;
  trailing?: ReactNode;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
}

/** Pastel event block used on calendar grids; long titles clamp so the grid never reflows. */
export function EventCard({ title, timeLabel, category, trailing, compact, className, onClick }: EventCardProps) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={`${title} (${timeLabel})`}
      className={cn("flex w-full min-w-0 items-start gap-2 rounded-control border-l-[3px] text-left", compact ? "p-1.5" : "p-2.5", onClick && "transition-shadow hover:shadow-card", className)}
      style={{ background: `var(${meta.bgVar})`, borderLeftColor: `var(${meta.dotVar})` }}
    >
      <Icon aria-hidden className={cn("mt-0.5 shrink-0", compact ? "size-3.5" : "size-4")} style={{ color: `var(${meta.dotVar})` }} />
      <span className="min-w-0 flex-1">
        <span className={cn("font-semibold text-text", compact ? "block truncate text-xs" : "line-clamp-2 text-sm")}>{title}</span>
        <span className="block truncate text-xs text-body">{timeLabel}</span>
      </span>
      {trailing}
      <span className="sr-only">{meta.label}</span>
    </Tag>
  );
}
