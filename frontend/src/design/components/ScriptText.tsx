import { Heart } from "lucide-react";
import { cn } from "../cn";

export function ScriptText({ children, heart = true, className }: { children: string; heart?: boolean; className?: string }) {
  return (
    <p className={cn("inline-flex items-end gap-1 font-script text-lg font-bold leading-tight text-script", className)}>
      <span>{children}</span>
      {heart ? <Heart aria-hidden className="mb-1 size-4 shrink-0 fill-current" /> : null}
    </p>
  );
}
