"use client";

import Link from "next/link";
import { ROUTES } from "@/app-shell/nav-config";
import { parseLocalDate } from "@/core/time/local-date";
import { CATEGORY_META } from "@/design/categories";
import { Countdown } from "@/design/components";
import { useItemEditor } from "@/features/items";
import { specialDayOccurrenceKey, type SpecialDayRow } from "@/features/special-days";
import { t } from "@/i18n/vi";
import { TodayRail } from "./TodayRail";

function dmy(date: string): string {
  const { year, month, day } = parseLocalDate(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** IMG-A "Ngày sắp tới": next date of each special day, lunar ones resolved to this year's solar date. */
export function UpcomingDaysRail({ rows }: { rows: SpecialDayRow[] }) {
  const openDetail = useItemEditor((s) => s.openDetail);
  return (
    <TodayRail title={t("today.upcoming.title")} seeAllHref={ROUTES.specialDays}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          {t("today.upcoming.empty")}{" "}
          <Link href={ROUTES.specialDays} className="font-semibold text-primary hover:underline">
            {t("today.upcoming.addSpecial")}
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-1" data-testid="upcoming-days">
          {rows.map(({ item, countdown }) => {
            const meta = CATEGORY_META[item.category];
            const Icon = meta.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openDetail(item.id, specialDayOccurrenceKey(item, countdown.date))}
                  className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-control px-1 py-2 text-left hover:bg-primary-soft"
                >
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-control" style={{ background: `var(${meta.bgVar})` }}>
                    <Icon className="size-4" style={{ color: `var(${meta.dotVar})` }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{item.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {dmy(countdown.date)}
                      {countdown.lunarNote ? ` ${countdown.lunarNote}` : ""}
                    </span>
                  </span>
                  <Countdown days={countdown.daysLeft} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </TodayRail>
  );
}
