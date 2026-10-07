import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { NotificationsPage } from "@/features/notifications";

export const metadata: Metadata = { title: t("notifications.title") };

export default function Page() {
  return <NotificationsPage />;
}
