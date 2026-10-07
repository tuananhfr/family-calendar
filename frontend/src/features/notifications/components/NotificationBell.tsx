"use client";

import { Bell } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { IconLink } from "@/design/components";
import { useActiveSpace } from "@/features/members";
import { t } from "@/i18n/vi";
import { useUnreadCount } from "../hooks/useNotifications";

export function NotificationBell() {
  const { space } = useActiveSpace();
  const unread = useUnreadCount(space?.id);
  return <IconLink href={ROUTES.notifications} label={t("nav.notifications")} icon={<Bell className="size-5" />} badge={unread} />;
}
