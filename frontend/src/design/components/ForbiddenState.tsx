import { Lock } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "../cn";

export function ForbiddenState({ title = t("common.forbiddenTitle"), body = t("common.forbiddenBody"), className }: { title?: string; body?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
      <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
        <Lock className="size-7" />
      </span>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="max-w-[48ch] text-sm text-muted">{body}</p>
    </div>
  );
}
