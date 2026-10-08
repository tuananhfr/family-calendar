"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Cake, FileText, ListChecks, Pill, Wallet } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { t } from "@/i18n/vi";
import type { TodayStats as Stats } from "../model/today-stats";

interface Tile {
  key: string;
  href: string;
  icon: ReactNode;
  value: number;
  label: string;
  sublabel?: string;
  tone: string;
}

/** The six counters of IMG-A; each opens the screen where those items are managed. */
export function TodayStats({ stats }: { stats: Stats }) {
  const tiles: Tile[] = [
    {
      key: "tasks",
      href: ROUTES.tasks,
      icon: <ListChecks />,
      value: stats.tasksToday,
      label: t("today.stats.tasksToday"),
      sublabel: stats.tasksToday > 0 ? t("today.stats.tasksDone", { done: stats.tasksDoneToday, total: stats.tasksToday }) : undefined,
      tone: "study",
    },
    { key: "schedules", href: ROUTES.calendar, icon: <CalendarDays />, value: stats.schedules, label: t("today.stats.schedules"), tone: "family" },
    {
      key: "special",
      href: ROUTES.specialDays,
      icon: <Cake />,
      value: stats.specialDays.count,
      label: t("today.stats.specialDays"),
      sublabel: stats.specialDays.firstLabel ?? t("today.stats.specialDaysNone"),
      tone: "health",
    },
    { key: "medication", href: ROUTES.health, icon: <Pill />, value: stats.medication, label: t("today.stats.medication"), tone: "special" },
    { key: "documents", href: ROUTES.upcoming, icon: <FileText />, value: stats.documentsDue, label: t("today.stats.documentsDue"), tone: "document" },
    { key: "expenses", href: ROUTES.finance, icon: <Wallet />, value: stats.expensesToLog, label: t("today.stats.expensesToLog"), tone: "finance" },
  ];
  return (
    <section aria-label={t("today.stats.label")}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <li key={tile.key} className="min-w-0">
            <Link href={tile.href} data-stat={tile.key} title={tile.sublabel ? `${tile.label}: ${tile.sublabel}` : tile.label} className="flex h-full min-h-24 flex-col gap-2 rounded-card border border-border bg-surface p-3 transition-colors hover:border-primary focus-visible:outline-offset-2">
              <span className="flex items-center gap-2.5">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-control [&_svg]:size-4" style={{ background: `var(--cat-${tile.tone}-bg)`, color: `var(--cat-${tile.tone}-dot)` }}>{tile.icon}</span>
                <span className="text-2xl font-bold leading-none tabular-nums text-text">{tile.value}</span>
              </span>
              <span className="text-xs font-medium leading-snug text-body">{tile.label}</span>
              {tile.sublabel ? <span className="sr-only">{tile.sublabel}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
