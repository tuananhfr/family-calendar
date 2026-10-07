"use client";

import { Search } from "lucide-react";
import { t } from "@/i18n/vi";
import { IconLink } from "@/design/components";
import { NotificationBell } from "@/features/notifications";
import { AppearanceControls } from "@/features/preferences/components/AppearanceControls";
import { ROUTES } from "./nav-config";
import { SosButton } from "./SosButton";
import { SpaceSwitcher } from "./SpaceSwitcher";

export function HeaderActions({ compact, showPreferences = true }: { compact?: boolean; showPreferences?: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
      {showPreferences ? <AppearanceControls compact={compact} /> : null}
      {!compact ? <IconLink href={ROUTES.search} label={t("nav.search")} icon={<Search className="size-5" />} /> : null}
      <NotificationBell />
      <SosButton />
      <SpaceSwitcher compact={compact} />
    </div>
  );
}
