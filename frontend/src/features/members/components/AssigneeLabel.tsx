"use client";

import type { Member } from "@/core/model/member";
import { cn } from "@/design/cn";
import { MemberAvatar } from "./MemberAvatar";

/** "Giao cho" / "Ai nhận" cell: one avatar + name, a short stack for several, `everyone` when nobody is picked. */
export function AssigneeLabel({ members, everyone, className }: { members: Member[]; everyone: string; className?: string }) {
  if (members.length === 0) return <span className={cn("text-sm text-body", className)}>{everyone}</span>;
  const names = members.map((m) => m.displayName).join(", ");
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)} title={names}>
      <span className="flex shrink-0 -space-x-2">
        {members.slice(0, 3).map((m) => (
          <MemberAvatar key={m.id} name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="xs" ring />
        ))}
      </span>
      <span className="min-w-0 truncate text-sm text-body">{names}</span>
    </span>
  );
}
