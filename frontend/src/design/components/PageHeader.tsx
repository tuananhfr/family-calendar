import type { ReactNode } from "react";
import { cn } from "../cn";
import { Illustration, type IllustrationName } from "./Illustration";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  illustration?: IllustrationName;
  actions?: ReactNode;
  className?: string;
}

/** Title block with the mockups' soft icon tile and top-right illustration (hidden on narrow screens). */
export function PageHeader({ title, subtitle, icon, illustration, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3", className)}>
      {icon ? (
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-card bg-surface text-primary shadow-sm [&_svg]:size-6">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="line-clamp-2 break-words text-xl font-bold" title={title}>
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex basis-full flex-wrap items-center gap-2 sm:basis-auto">{actions}</div> : null}
      {illustration ? <Illustration name={illustration} height={88} className="hidden lg:block" /> : null}
    </header>
  );
}
