import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "../cn";
import { Illustration, type IllustrationName } from "./Illustration";

export function EmptyState({ title, body, action, illustration, className }: { title: string; body?: string; action?: ReactNode; illustration?: IllustrationName; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
      {illustration ? (
        <Illustration name={illustration} height={96} className="max-w-full" />
      ) : (
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Inbox className="size-7" />
        </span>
      )}
      <h3 className="text-base font-bold">{title}</h3>
      {body ? <p className="max-w-[48ch] text-sm text-muted">{body}</p> : null}
      {action}
    </div>
  );
}
