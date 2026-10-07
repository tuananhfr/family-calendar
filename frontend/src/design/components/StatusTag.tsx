import { Ban, Circle, CircleAlert, CircleCheck } from "lucide-react";
import { t } from "@/i18n/vi";
import { Badge } from "./Badge";

export type TaskStatus = "TODO" | "DONE" | "OVERDUE" | "CANCELLED";

const META = {
  TODO: { tone: "neutral", icon: Circle },
  DONE: { tone: "success", icon: CircleCheck },
  OVERDUE: { tone: "danger", icon: CircleAlert },
  CANCELLED: { tone: "neutral", icon: Ban },
} as const;

export function StatusTag({ status, label }: { status: TaskStatus; label?: string }) {
  const { tone, icon: Icon } = META[status];
  return (
    <Badge tone={tone} icon={<Icon aria-hidden className="size-3.5" />}>
      {label ?? t(`status.${status}`)}
    </Badge>
  );
}
