"use client";

import { isSpecialDayPreset } from "@/core/model/common";
import type { Member } from "@/core/model/member";
import { CATEGORY_META } from "@/design/categories";
import { cn } from "@/design/cn";
import { Badge, Countdown } from "@/design/components";
import { formatDateVi, useItemEditor } from "@/features/items";
import { t } from "@/i18n/vi";
import { specialDayOccurrenceKey, yearsOn, type SpecialDayRow } from "../model/special-day-list";
import { SPECIAL_KIND_ICON } from "./kind-icons";

function yearsText(row: SpecialDayRow): string | undefined {
  const n = yearsOn(row.item, row.countdown.date);
  if (n === undefined) return undefined;
  return t(row.item.preset === "BIRTHDAY" ? "specialDays.age" : "specialDays.years", { n });
}

/** One special day; `featured` is the nearest one, shown larger at the top of the page. */
export function SpecialDayCard({ row, memberById, featured }: { row: SpecialDayRow; memberById: Map<string, Member>; featured?: boolean }) {
  const openDetail = useItemEditor((s) => s.openDetail);
  const { item, countdown } = row;
  const meta = CATEGORY_META[item.category];
  const Icon = isSpecialDayPreset(item.preset) ? SPECIAL_KIND_ICON[item.preset] : meta.icon;
  const who = item.memberIds
    .map((id) => memberById.get(id)?.displayName)
    .filter(Boolean)
    .join(", ");
  const years = yearsText(row);
  const countdownPill = <Countdown days={countdown.daysLeft} className={cn("rounded-chip bg-surface-2 px-2 py-0.5", featured && "md:text-sm")} />;
  return (
    <button
      type="button"
      aria-label={t("specialDays.open", { title: item.title })}
      onClick={() => openDetail(item.id, specialDayOccurrenceKey(item, countdown.date))}
      data-testid="special-day-card"
      className={cn(
        "flex w-full min-w-0 items-start gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-sm transition-shadow hover:shadow-card",
        featured && "md:items-center md:gap-5 md:p-6",
      )}
    >
      <span
        aria-hidden
        className={cn("flex shrink-0 items-center justify-center rounded-card", featured ? "size-12 md:size-16" : "size-11")}
        style={{ background: `var(${meta.bgVar})` }}
      >
        <Icon className={featured ? "size-6 md:size-8" : "size-5"} style={{ color: `var(${meta.dotVar})` }} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {featured ? <span className="text-xs font-semibold uppercase tracking-wide text-primary">{t("specialDays.nextUp")}</span> : null}
        <span className={cn("line-clamp-2 break-words font-bold text-text", featured ? "text-lg md:text-xl" : "text-base")} title={item.title}>
          {item.title}
        </span>
        <span className="text-sm text-body">
          {formatDateVi(countdown.date)}
          {countdown.lunarNote ? <span className="whitespace-nowrap font-medium text-primary"> {countdown.lunarNote}</span> : null}
        </span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
          {/* In the narrow grid cells a right-hand countdown would squeeze the title to a few letters. */}
          <span className={cn("flex", featured && "md:hidden")}>{countdownPill}</span>
          <Badge tone="neutral">{isSpecialDayPreset(item.preset) ? t(`items.specialKinds.${item.preset}`) : t("items.types.SPECIAL.label")}</Badge>
          {item.calendarSystem === "LUNAR" ? <Badge tone="primary">{t("specialDays.lunar")}</Badge> : null}
          {years ? <Badge tone="success">{years}</Badge> : null}
          {who ? <span className="min-w-0 truncate text-xs text-muted">{who}</span> : null}
        </span>
      </span>
      {featured ? <span className="hidden shrink-0 md:block">{countdownPill}</span> : null}
    </button>
  );
}
