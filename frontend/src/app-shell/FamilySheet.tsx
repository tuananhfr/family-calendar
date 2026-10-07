"use client";

import Link from "next/link";
import { t } from "@/i18n/vi";
import { Sheet } from "@/design/components";
import { FAMILY_SHEET_ITEMS } from "./nav-config";
import { useShellStore } from "./shell-store";
import { useVisibleNav } from "./useVisibleNav";

export function FamilySheet() {
  const open = useShellStore((s) => s.familySheetOpen);
  const setOpen = useShellStore((s) => s.setFamilySheetOpen);
  const tasksToday = useShellStore((s) => s.tasksToday);
  const items = useVisibleNav(FAMILY_SHEET_ITEMS);
  return (
    <Sheet open={open} onOpenChange={setOpen} title={t("nav.family")}>
      <ul className="grid grid-cols-3 gap-2 pb-2">
        {items.map((item) => {
          const Icon = item.icon;
          const badge = item.badge === "tasksToday" && tasksToday > 0 ? tasksToday : 0;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="relative flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-control border border-border bg-surface-2 px-1 text-center text-xs font-medium text-text hover:border-primary hover:text-primary"
              >
                <Icon aria-hidden className="size-6 text-primary" />
                <span className="line-clamp-2">{item.label}</span>
                {badge ? <span className="absolute right-2 top-2 rounded-chip bg-danger px-1.5 text-[10px] font-bold leading-4 text-on-primary">{badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
