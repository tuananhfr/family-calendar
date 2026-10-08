"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { t } from "@/i18n/vi";
import { FAMILY_SHEET_ITEMS, FOOTER_LINKS, ROUTES, SIDEBAR_ITEMS, isActive } from "./nav-config";

export function AppBreadcrumb() {
  const pathname = usePathname();
  const current = [...SIDEBAR_ITEMS, ...FAMILY_SHEET_ITEMS, ...FOOTER_LINKS].find((item) => isActive(item.href, pathname));
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
      <Link href={ROUTES.today} className="hidden shrink-0 rounded-control text-muted hover:text-primary xl:inline">{t("nav.family")}</Link>
      <ChevronRight aria-hidden className="hidden size-3.5 shrink-0 text-muted xl:block" />
      <span className="truncate font-semibold text-text" aria-current="page">{current?.label ?? t("appName")}</span>
    </div>
  );
}
