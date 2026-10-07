"use client";

import type { Member } from "@/core/model/member";
import { cn } from "@/design/cn";
import { MemberAvatar } from "@/features/members";
import { t } from "@/i18n/vi";

/** One member at a time for "Theo thành viên"; a radio group, unlike the multi-select filter chips. */
export function MemberPicker({ members, value, onChange }: { members: Member[]; value?: string; onChange: (id: string) => void }) {
  if (members.length === 0) return <p className="text-sm text-muted">{t("timetable.noMembers")}</p>;
  return (
    <div role="radiogroup" aria-label={t("timetable.memberPicker")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {members.map((m) => {
        const on = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(m.id)}
            className={cn(
              "inline-flex min-h-[var(--touch-min)] shrink-0 items-center gap-2 rounded-chip border py-1 pl-1 pr-4 text-sm font-medium transition-colors",
              on ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text hover:border-primary",
            )}
          >
            <MemberAvatar name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="sm" />
            {m.displayName}
          </button>
        );
      })}
    </div>
  );
}
