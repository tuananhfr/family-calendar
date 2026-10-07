"use client";

import { Info } from "lucide-react";
import { PermissionPrompt } from "@/features/notifications";
import { t } from "@/i18n/vi";

export function NotificationsTab() {
  return (
    <div className="flex flex-col gap-4">
      <PermissionPrompt />
      <p className="flex items-start gap-2 text-sm text-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t("notifications.limits")}
      </p>
    </div>
  );
}
