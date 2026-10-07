import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { MembersScreen } from "@/features/members";

export const metadata: Metadata = { title: t("members.title") };

export default function MembersPage() {
  return <MembersScreen />;
}
