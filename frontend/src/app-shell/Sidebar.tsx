"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "@/design/cn";
import { QUICK_TOOLS, SIDEBAR_ITEMS, isActive, type NavItem } from "./nav-config";
import { useShellStore } from "./shell-store";
import { useVisibleNav } from "./useVisibleNav";

function NavLink({ item, collapsible, shortcut, onNavigate }: { item: NavItem; collapsible: boolean; shortcut?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const tasksToday = useShellStore((s) => s.tasksToday);
  const setQuickAddOpen = useShellStore((s) => s.setQuickAddOpen);
  // Quick tools are shortcuts into screens the main list already marks; lighting both reads as two places.
  const active = !item.action && !shortcut && isActive(item.href, pathname);
  const badge = item.badge === "tasksToday" && tasksToday > 0 ? tasksToday : 0;
  const Icon = item.icon;
  // sr-only (not display:none) keeps the accessible name when the rail collapses to icons.
  const labelClass = collapsible ? "sr-only xl:not-sr-only xl:truncate" : "truncate";
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        if (item.action === "quickAdd") {
          e.preventDefault();
          setQuickAddOpen(true);
        }
        onNavigate?.();
      }}
      className={cn(
        "relative flex min-h-[var(--touch-min)] items-center gap-3 rounded-control px-3 text-sm transition-colors",
        // Desktop rail uses 40px rows so the whole menu fits a 900px-high screen like the mockup.
        collapsible && "justify-center lg:min-h-10 xl:justify-start",
        active ? "bg-primary-soft font-semibold text-primary" : "text-body hover:bg-primary-soft/60 hover:text-primary",
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className={cn("min-w-0 flex-1", labelClass)}>{item.label}</span>
      {badge ? (
        <span className={cn("rounded-chip bg-danger px-1.5 text-[11px] font-bold leading-5 text-on-primary", collapsible && "absolute right-1.5 top-1 xl:static")}>{badge}</span>
      ) : null}
    </Link>
  );
}

/** collapsible: icon rail at 1024–1279px, full labels from 1280px; the drawer variant always shows labels. */
export function Sidebar({ collapsible = true, onNavigate }: { collapsible?: boolean; onNavigate?: () => void }) {
  const setQuickAddOpen = useShellStore((s) => s.setQuickAddOpen);
  const sidebarItems = useVisibleNav(SIDEBAR_ITEMS);
  const quickTools = useVisibleNav(QUICK_TOOLS);
  const coreKeys = ["today", "calendar", "tasks", "reminders", "upcoming", "timetable", "specialDays", "members"];
  const primary = coreKeys.flatMap((key) => sidebarItems.filter((item) => item.key === key));
  const secondary = sidebarItems.filter((item) => !coreKeys.includes(item.key) && item.key !== "settings");
  const resourceKeys = ["health", "finance", "storage"];
  const resources = secondary.filter((item) => resourceKeys.includes(item.key));
  const utilities = secondary.filter((item) => !resourceKeys.includes(item.key));
  const settings = sidebarItems.find((item) => item.key === "settings");
  return (
    <nav aria-label={t("nav.mainNav")} className="flex h-full flex-col gap-1 px-3 py-5">
      <button
        type="button"
        onClick={() => {
          setQuickAddOpen(true);
          onNavigate?.();
        }}
        title={t("nav.addNew")}
        className={cn(
          "mb-4 flex min-h-[calc(var(--touch-min)+4px)] items-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover",
          collapsible && "justify-center px-0 xl:justify-start xl:px-4",
        )}
      >
        <Plus aria-hidden className="size-5 shrink-0" />
        <span className={collapsible ? "sr-only xl:not-sr-only" : undefined}>{t("nav.addNew")}</span>
      </button>
      {primary.map((item) => (
        <NavLink key={item.key} item={item} collapsible={collapsible} onNavigate={onNavigate} />
      ))}
      <div className="my-3 border-t border-border" />
      {resources.map((item) => (
        <NavLink key={item.key} item={item} collapsible={collapsible} onNavigate={onNavigate} />
      ))}
      {collapsible ? <div className="flex flex-col gap-1 xl:hidden">{utilities.map((item) => <NavLink key={item.key} item={item} collapsible onNavigate={onNavigate} />)}</div> : null}
      <details className={cn("mt-4 border-t border-border pt-3", collapsible && "hidden xl:block")}>
        <summary className="mb-1 cursor-pointer rounded-control px-3 py-2 text-xs font-semibold text-muted hover:text-primary">{t("nav.quickTools")}</summary>
        {utilities.map((item) => <NavLink key={item.key} item={item} collapsible={false} onNavigate={onNavigate} />)}
        <div className="my-2 border-t border-border" />
        {quickTools.map((item) => (
          <NavLink key={item.key} item={item} collapsible={false} shortcut onNavigate={onNavigate} />
        ))}
      </details>
      {settings ? <div className="mt-auto border-t border-border pt-3"><NavLink item={settings} collapsible={collapsible} onNavigate={onNavigate} /></div> : null}
    </nav>
  );
}
