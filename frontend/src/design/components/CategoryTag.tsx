import { cn } from "../cn";
import { CATEGORY_META, type Category } from "../categories";

export function CategoryTag({ category, label, className }: { category: Category; label?: string; className?: string }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const text = label ?? meta.label;
  return (
    <span
      title={text}
      className={cn("inline-flex max-w-full items-center gap-1 rounded-chip px-2 py-0.5 text-xs font-semibold text-text", className)}
      style={{ background: `var(${meta.bgVar})` }}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" style={{ color: `var(${meta.dotVar})` }} />
      <span className="truncate">{text}</span>
    </span>
  );
}
