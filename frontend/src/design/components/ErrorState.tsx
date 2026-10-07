import { RefreshCw, TriangleAlert } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "../cn";
import { Button } from "./Button";

export function ErrorState({ title = t("common.errorTitle"), body = t("common.errorBody"), onRetry, className }: { title?: string; body?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
      <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <TriangleAlert className="size-7" />
      </span>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="max-w-[48ch] text-sm text-muted">{body}</p>
      {onRetry ? (
        <Button variant="secondary" icon={<RefreshCw aria-hidden className="size-4" />} onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}
