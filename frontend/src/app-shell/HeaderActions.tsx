"use client";

import { Search } from "lucide-react";
import { t } from "@/i18n/vi";
import { IconLink } from "@/design/components";
import { NotificationBell } from "@/features/notifications";
import { ROUTES } from "./nav-config";
import { SosButton } from "./SosButton";
import { SpaceSwitcher } from "./SpaceSwitcher";

export function HeaderActions({ compact }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
      {!compact ? <IconLink href={ROUTES.search} label={t("nav.search")} icon={<Search className="size-5" />} /> : null}
      <NotificationBell />
      <SosButton />
      <SpaceSwitcher compact={compact} />
    </div>
  );
}
