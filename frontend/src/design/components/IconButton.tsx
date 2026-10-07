import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  variant?: "ghost" | "soft" | "outline";
  badge?: number;
}

export function IconButton({ label, icon, variant = "ghost", badge, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={badge ? `${label} (${badge})` : label}
      title={label}
      className={cn(
        "relative inline-flex size-[var(--touch-min)] shrink-0 items-center justify-center rounded-control text-body transition-colors",
        "hover:bg-primary-soft hover:text-primary active:translate-y-px disabled:pointer-events-none disabled:text-disabled-text",
        variant === "soft" && "bg-primary-soft text-primary",
        variant === "outline" && "border border-border bg-surface",
        className,
      )}
      {...rest}
    >
      {icon}
      {badge ? (
        <span aria-hidden className="absolute right-1.5 top-1.5 min-w-4 rounded-chip bg-danger px-1 text-center text-[10px] font-bold leading-4 text-on-primary">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}
