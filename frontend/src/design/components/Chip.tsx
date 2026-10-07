import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: ReactNode;
}

export function Chip({ selected, icon, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 max-w-[16rem] shrink-0 items-center gap-1.5 rounded-control border px-3 text-sm font-medium transition-colors",
        selected ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-body hover:border-primary hover:text-primary",
        className,
      )}
      {...rest}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}
