import { PRIORITY_META, type Priority } from "../categories";
import { Badge } from "./Badge";

export function PriorityTag({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone} icon={<Icon aria-hidden className="size-3.5" />}>
      {meta.label}
    </Badge>
  );
}
