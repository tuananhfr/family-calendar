"use client";

import type { Member } from "@/core/model/member";
import { CATEGORY_META } from "@/design/categories";
import { Countdown } from "@/design/components";
import { formatDateVi, useItemEditor } from "@/features/items";
import { t } from "@/i18n/vi";
import { upcomingKindOf, type UpcomingEntry } from "../model/group-upcoming";

/** One deadline: tap opens the detail sheet, where Đã xong / Sửa / Xóa live. */
export function UpcomingRow({ entry, memberById }: { entry: UpcomingEntry; memberById: Map<string, Member> }) {
  const openDetail = useItemEditor((s) => s.openDetail);
  const { item, occurrence, due: dueDate, daysLeft = 0, overdueCount = 0 } = entry;
  const meta = CATEGORY_META[item.category];
  const Icon = meta.icon;
  const title = occurrence.title ?? item.title;
  const who = item.memberIds.map((id) => memberById.get(id)?.displayName).filter(Boolean).join(", ");
  const olderMissed = Math.max(overdueCount - 1, 0);
  const dueBadge =
    daysLeft < 0 ? (
      <span className="whitespace-nowrap rounded-chip bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">{t("upcoming.overdueBy", { n: -daysLeft })}</span>
    ) : (
      <Countdown days={daysLeft} />
    );
  return (
    <li>
      <button
        type="button"
        aria-label={t("upcoming.open", { title })}
        onClick={() => openDetail(item.id, occurrence.occurrenceKey)}
        className="flex w-full min-w-0 items-center gap-3 rounded-control px-2 py-2.5 text-left transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft"
        data-testid="upcoming-row"
      >
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control" style={{ background: `var(${meta.bgVar})` }}>
          <Icon className="size-5" style={{ color: `var(${meta.dotVar})` }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words font-semibold text-text sm:line-clamp-1" title={title}>
            {title}
          </span>
          <span className="block text-sm text-muted sm:truncate">
            {formatDateVi(dueDate)} · {t(`upcoming.kinds.${upcomingKindOf(item)}`)}
            {who ? ` · ${who}` : ""}
          </span>
          {olderMissed > 0 ? <span className="block text-xs font-medium text-danger">{t("upcoming.overdueMore", { n: olderMissed })}</span> : null}
          {/* Phones: under the date, so the title keeps the full row. */}
          <span className="mt-1 flex sm:hidden">{dueBadge}</span>
        </span>
        <span className="hidden shrink-0 sm:block">{dueBadge}</span>
      </button>
    </li>
  );
}
