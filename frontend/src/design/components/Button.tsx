import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader } from "lucide-react";
import { cn } from "../cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-sm",
  secondary: "bg-surface text-primary border border-border-strong hover:bg-primary-soft",
  ghost: "bg-transparent text-body hover:bg-primary-soft hover:text-primary",
  danger: "bg-danger text-on-primary hover:opacity-90",
  soft: "bg-primary-soft text-primary hover:bg-primary hover:text-on-primary",
};
const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "min-h-[var(--touch-min)] px-4 text-sm gap-2",
  lg: "min-h-[calc(var(--touch-min)+4px)] px-5 text-base gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", block = false) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-control font-semibold transition-colors duration-150",
    "active:translate-y-px disabled:pointer-events-none disabled:border-transparent disabled:bg-disabled disabled:text-disabled-text disabled:shadow-none",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
  );
}

export function Button({ variant = "primary", size = "md", icon, loading, block, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonClass(variant, size, block), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
