"use client";

import Link from "next/link";
import { t } from "@/i18n/vi";
import { BrandLogo } from "@/design/components";
import { AppearanceControls } from "@/features/preferences/components/AppearanceControls";
import { HeaderActions } from "./HeaderActions";
import { ROUTES } from "./nav-config";

export function MobileHeader() {
  return (
    <header data-mobile-header className="sticky top-0 z-30 grid h-16 grid-cols-[auto_auto_1fr] items-center gap-x-2 border-b border-border bg-surface/95 px-3 backdrop-blur max-[479px]:h-auto max-[479px]:grid-cols-[auto_1fr] md:hidden">
      <Link href={ROUTES.today} aria-label={t("appName")} className="shrink-0">
        <BrandLogo compact className="[&>span]:size-9 [&_svg]:scale-90" />
      </Link>
      <AppearanceControls compact className="max-[479px]:col-span-2 max-[479px]:row-start-2 max-[479px]:justify-end max-[479px]:border-t max-[479px]:border-border max-[479px]:pb-1" />
      <div className="flex min-w-0 justify-end max-[479px]:col-start-2 max-[479px]:row-start-1 max-[479px]:min-h-16">
        <HeaderActions compact showPreferences={false} />
      </div>
    </header>
  );
}
