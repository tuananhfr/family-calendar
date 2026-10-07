import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { RemindersPage } from "@/features/reminders";

export const metadata: Metadata = { title: t("reminders.title") };

export default function Page() {
  return <RemindersPage />;
}
