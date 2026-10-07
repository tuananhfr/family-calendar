import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "../cn";

export function IconLink({ href, label, icon, badge, className }: { href: string; label: string; icon: ReactNode; badge?: number; className?: string }) {
  return (
    <Link
      href={href}
      aria-label={badge ? `${label} (${badge})` : label}
      title={label}
      className={cn(
        "relative inline-flex size-[var(--touch-min)] shrink-0 items-center justify-center rounded-control text-body transition-colors hover:bg-primary-soft hover:text-primary",
        className,
      )}
    >
      {icon}
      {badge ? (
        <span aria-hidden className="absolute right-1.5 top-1.5 min-w-4 rounded-chip bg-danger px-1 text-center text-[10px] font-bold leading-4 text-on-primary">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
