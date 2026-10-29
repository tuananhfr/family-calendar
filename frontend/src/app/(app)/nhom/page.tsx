import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { GroupsScreen } from "@/features/groups/components/GroupsScreen";

export const metadata: Metadata = { title: t("groups.title") };

export default function GroupsPage() {
  return <GroupsScreen />;
}
