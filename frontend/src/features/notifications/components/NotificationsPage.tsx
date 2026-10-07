"use client";

import { useMemo, useState } from "react";
import { Bell, CheckCheck, Info } from "lucide-react";
import { DEFAULT_TIME_ZONE } from "@/core/model/common";
import { markAllRead } from "@/core/notifications/local-center";
import { Button, Card, EmptyState, PageHeader, SkeletonList, Tabs } from "@/design/components";
import { useActiveSpace, useSpaceToday } from "@/features/members";
import { t } from "@/i18n/vi";
import { useNotifications } from "../hooks/useNotifications";
import { groupNotifications } from "../model/notification-groups";
import { NotificationList } from "./NotificationList";
import { PermissionPrompt } from "./PermissionPrompt";

type Tab = "ALL" | "UNREAD";

/** `/thong-bao` (modules.md §13): the local notification center, newest first, grouped by day. */
export function NotificationsPage() {
  const { space } = useActiveSpace();
  const today = useSpaceToday();
  const timeZone = space?.timeZone ?? DEFAULT_TIME_ZONE;
  const { loading, rows } = useNotifications(space?.id);
  const [tab, setTab] = useState<Tab>("ALL");
  const unread = rows.filter((r) => r.readAt === null).length;
  const groups = useMemo(() => groupNotifications(tab === "UNREAD" ? rows.filter((r) => r.readAt === null) : rows, today, timeZone), [rows, tab, today, timeZone]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        icon={<Bell />}
        illustration="corner-reminders"
        actions={
          <Button variant="secondary" icon={<CheckCheck className="size-4" />} onClick={() => void markAllRead()} disabled={unread === 0}>
            {t("notifications.markAllRead")}
          </Button>
        }
      />
      <PermissionPrompt />
      <Card padded={false} className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 pt-4 md:px-5">
          <Tabs
            label={t("notifications.tabsLabel")}
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
            items={(["ALL", "UNREAD"] as const).map((x) => ({ value: x, label: x === "UNREAD" && unread > 0 ? `${t("notifications.tabs.UNREAD")} (${unread})` : t(`notifications.tabs.${x}`) }))}
          />
          <p className="pb-3 text-sm text-muted" aria-live="polite">
            {unread > 0 ? t("notifications.unreadCount", { n: unread }) : t("notifications.allRead")}
          </p>
        </div>
        {loading ? (
          <div className="p-5">
            <SkeletonList rows={4} />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState title={tab === "UNREAD" && rows.length > 0 ? t("notifications.empty.unreadTitle") : t("notifications.empty.title")} body={t("notifications.empty.body")} illustration="corner-reminders" />
        ) : (
          <NotificationList groups={groups} timeZone={timeZone} />
        )}
      </Card>
      <p className="flex items-start gap-2 text-sm text-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t("notifications.limits")}
      </p>
    </div>
  );
}
