"use client";

import Link from "next/link";
import { t } from "@/i18n/vi";
import { Illustration } from "@/design/components";
import { HeaderActions } from "./HeaderActions";
import { ROUTES } from "./nav-config";

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur md:hidden">
      <Link href={ROUTES.today} aria-label={t("appName")} className="shrink-0">
        <Illustration name="logo-mark" height={36} className="rounded-full" priority />
      </Link>
      <div className="flex min-w-0 flex-1 justify-end">
        <HeaderActions compact />
      </div>
    </header>
  );
}
