"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Cake, FileText, ListChecks, Pill, Wallet } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { StatCard } from "@/design/components";
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
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
        {tiles.map((tile) => (
          <li key={tile.key} className="min-w-0">
            <Link href={tile.href} data-stat={tile.key} className="block h-full rounded-card transition-shadow hover:shadow-card">
              <StatCard icon={tile.icon} value={tile.value} label={tile.label} sublabel={tile.sublabel} tone={tile.tone} className="h-full" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
