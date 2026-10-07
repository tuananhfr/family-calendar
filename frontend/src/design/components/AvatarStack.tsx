import { t } from "@/i18n/vi";
import { Avatar, type AvatarProps } from "./Avatar";

export function AvatarStack({ people, max = 3, size = "sm" }: { people: Omit<AvatarProps, "size" | "ring">[]; max?: number; size?: AvatarProps["size"] }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center -space-x-2" aria-label={people.map((p) => p.name).join(", ")}>
      {shown.map((p) => (
        <Avatar key={p.name} {...p} size={size} ring />
      ))}
      {rest > 0 ? <span className="pl-3 text-xs font-semibold text-muted">{t("ui.moreMembers", { n: rest })}</span> : null}
    </span>
  );
}
