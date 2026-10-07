import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { TasksPage } from "@/features/tasks";

export const metadata: Metadata = { title: t("tasks.title") };

export default function Page() {
  return <TasksPage />;
}
