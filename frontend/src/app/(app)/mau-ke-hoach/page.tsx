import type { Metadata } from "next";
import { TemplatesPage } from "@/features/templates";
import { t } from "@/i18n/vi";

export const metadata: Metadata = { title: t("templates.title") };

export default function Page() {
  return <TemplatesPage />;
}
