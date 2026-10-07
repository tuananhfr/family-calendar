import type { HTMLAttributes } from "react";
import { cn } from "../cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  interactive?: boolean;
}

export function Card({ padded = true, interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-card border border-border bg-surface shadow-sm",
        padded && "p-4 md:p-5",
        interactive && "transition-shadow hover:shadow-card",
        className,
      )}
      {...rest}
    />
  );
}
