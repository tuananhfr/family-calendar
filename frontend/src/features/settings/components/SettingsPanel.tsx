import type { ReactNode } from "react";
import { cn } from "@/design/cn";

/** One block of a settings tab: icon tile, title, explanation, then its controls. */
export function SettingsPanel({ icon, title, body, children, tone = "primary", className, id }: { icon: ReactNode; title: string; body?: ReactNode; children?: ReactNode; tone?: "primary" | "danger"; className?: string; id?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("flex flex-col gap-4 rounded-card border bg-surface p-4 shadow-sm md:p-5", tone === "danger" ? "border-danger/40" : "border-border", className)}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-card [&_svg]:size-5", tone === "danger" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary")}>
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-base font-bold text-text">
            {title}
          </h2>
          {body ? <div className="max-w-[72ch] text-sm text-body">{body}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
