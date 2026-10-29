import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";

export function SetupStep({ index, title, done, children }: { index: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", done ? "bg-primary text-on-primary" : "border border-border-strong text-muted")}>
        {done ? <Check className="size-4" /> : index}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
        <h3 className="text-sm font-semibold text-text">
          {title}
          {done ? <span className="sr-only"> ({t("sharing.stepDone")})</span> : null}
        </h3>
        {children}
      </div>
    </li>
  );
}
