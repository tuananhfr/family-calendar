"use client";

import * as Popover from "@radix-ui/react-popover";
import { Filter } from "lucide-react";
import type { Member } from "@/core/model/member";
import { buttonClass } from "@/design/components";
import { cn } from "@/design/cn";
import { MemberChips } from "@/features/members";
import { t } from "@/i18n/vi";
import { useAppStore } from "@/store/app.store";

/** Member filter shared with Today (same store key), so a filter chosen on one screen carries to the other. */
export function CalendarFilters({ members, className }: { members: Member[]; className?: string }) {
  const filter = useAppStore((s) => s.memberFilter);
  const setFilter = useAppStore((s) => s.setMemberFilter);
  return (
    <Popover.Root>
      <Popover.Trigger className={cn(buttonClass("secondary", "sm"), className)}>
        <Filter aria-hidden className="size-4" />
        {t("calendar.filter")}
        {filter !== "ALL" ? <span className="rounded-chip bg-primary px-1.5 text-xs text-on-primary">{filter.length}</span> : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-control border border-border bg-surface p-3 shadow-pop">
          <MemberChips members={members} value={filter} onChange={setFilter} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
