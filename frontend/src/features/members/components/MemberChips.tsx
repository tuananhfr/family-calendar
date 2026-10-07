"use client";

import type { Member } from "@/core/model/member";
import { Chip } from "@/design/components";
import { t } from "@/i18n/vi";
import { MemberAvatar } from "./MemberAvatar";

/** Horizontal member filter (Tất cả / Bố / Mẹ / …); an empty selection means everyone. */
export function MemberChips({ members, value, onChange }: { members: Member[]; value: string[] | "ALL"; onChange: (v: string[] | "ALL") => void }) {
  const active = members.filter((m) => m.status === "ACTIVE");
  const isAll = value === "ALL";
  const toggle = (id: string) => {
    const current = isAll ? [] : value;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange(next.length === 0 || next.length === active.length ? "ALL" : next);
  };
  return (
    <div role="group" aria-label={t("members.chips.label")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <Chip selected={isAll} onClick={() => onChange("ALL")}>
        {t("members.chips.all")}
      </Chip>
      {active.map((m) => (
        <Chip
          key={m.id}
          selected={!isAll && value.includes(m.id)}
          onClick={() => toggle(m.id)}
          icon={<MemberAvatar name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="xs" />}
        >
          {m.displayName}
        </Chip>
      ))}
    </div>
  );
}
