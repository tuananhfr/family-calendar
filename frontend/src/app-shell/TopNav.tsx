"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n/vi";
import { cn } from "@/design/cn";
import { TOPNAV_ITEMS, isActive } from "./nav-config";

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label={t("nav.quickNav")} className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] max-lg:[mask-image:linear-gradient(to_right,black_85%,transparent)]">
      <ul className="flex h-full items-stretch gap-1">
        {TOPNAV_ITEMS.map((item) => {
          const active = isActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-16 flex-col items-center justify-center gap-1 px-2.5 text-xs font-medium transition-colors xl:min-w-[4.75rem] xl:px-3",
                  active ? "bg-primary-soft text-primary" : "text-body hover:text-primary",
                )}
              >
                <Icon aria-hidden className="size-5" />
                <span className="whitespace-nowrap">{item.label}</span>
                {active ? <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-chip bg-primary" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
