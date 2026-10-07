"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { t } from "@/i18n/vi";
import { cn } from "@/design/cn";
import { MOBILE_TABS, isActive, type NavItem } from "./nav-config";
import { useShellStore } from "./shell-store";

function tabActive(item: NavItem, pathname: string, view: string | null): boolean {
  if (item.action) return false;
  // "Tuần" and a plain calendar visit share /lich/, so the view param decides which tab lights up.
  if (item.key === "week") return isActive(item.href, pathname) && view === "week";
  return isActive(item.href, pathname);
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const setQuickAddOpen = useShellStore((s) => s.setQuickAddOpen);
  const setFamilySheetOpen = useShellStore((s) => s.setFamilySheetOpen);
  return (
    <nav aria-label={t("nav.mainNav")} className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid h-16 grid-cols-5">
        {MOBILE_TABS.map((item) => {
          const Icon = item.icon;
          const active = tabActive(item, pathname, view);
          if (item.key === "add") {
            return (
              <li key={item.key} className="flex items-center justify-center">
                <button
                  type="button"
                  aria-label={t("nav.addNew")}
                  onClick={() => setQuickAddOpen(true)}
                  className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-pop ring-4 ring-surface active:scale-95"
                >
                  <Icon aria-hidden className="size-7" />
                </button>
              </li>
            );
          }
          return (
            <li key={item.key} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (item.action === "familySheet") {
                    e.preventDefault();
                    setFamilySheetOpen(true);
                  }
                }}
                className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-primary" : "text-muted")}
              >
                <Icon aria-hidden className="size-6" />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
