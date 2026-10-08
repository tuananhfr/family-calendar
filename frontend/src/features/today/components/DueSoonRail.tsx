"use client";

import { ROUTES } from "@/app-shell/nav-config";
import { CATEGORY_META } from "@/design/categories";
import { Countdown } from "@/design/components";
import { useItemEditor } from "@/features/items";
import type { UpcomingEntry } from "@/features/upcoming";
import { t } from "@/i18n/vi";
import { TodayRail } from "./TodayRail";

/** v3.0 "Sắp đến hạn": overdue deadlines first, then the next 7 days. */
export function DueSoonRail({ rows }: { rows: UpcomingEntry[] }) {
  const openDetail = useItemEditor((s) => s.openDetail);
  return (
    <TodayRail title={t("today.dueSoon.title")} seeAllHref={ROUTES.upcoming}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("today.dueSoon.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1" data-testid="due-soon">
          {rows.map(({ item, occurrence, daysLeft = 0 }) => {
            const meta = CATEGORY_META[item.category];
            const Icon = meta.icon;
            return (
              <li key={occurrence.occurrenceKey}>
                <button
                  type="button"
                  onClick={() => openDetail(item.id, occurrence.occurrenceKey)}
                  className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-control px-1 py-2 text-left hover:bg-primary-soft"
                >
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-control" style={{ background: `var(${meta.bgVar})` }}>
                    <Icon className="size-4" style={{ color: `var(${meta.dotVar})` }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{occurrence.title ?? item.title}</span>
                  {daysLeft < 0 ? (
                    <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-danger">{t("today.dueSoon.overdue", { n: -daysLeft })}</span>
                  ) : (
                    <Countdown days={daysLeft} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </TodayRail>
  );
}
