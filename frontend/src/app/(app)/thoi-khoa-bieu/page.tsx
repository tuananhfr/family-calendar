import type { Metadata } from "next";
import { TimetablePage } from "@/features/timetable";
import { t } from "@/i18n/vi";

export const metadata: Metadata = { title: t("timetable.title") };

export default function Page() {
  return <TimetablePage />;
}
