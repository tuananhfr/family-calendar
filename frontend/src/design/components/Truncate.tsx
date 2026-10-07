import { cn } from "../cn";

/** Clamped text that keeps the full value reachable via title (Review Focus #2). */
export function Truncate({ text, lines = 1, className }: { text: string; lines?: 1 | 2 | 3; className?: string }) {
  return (
    <span title={text} className={cn("min-w-0 break-words", lines === 1 ? "block truncate" : lines === 2 ? "line-clamp-2" : "line-clamp-3", className)}>
      {text}
    </span>
  );
}
