import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design/components";
import { t } from "@/i18n/vi";
import { EmergencyScreen } from "@/features/emergency/components/EmergencyScreen";

export const metadata: Metadata = { title: t("emergency.title") };

export default function SosPage() {
  return <Suspense fallback={<Skeleton className="h-48" />}><EmergencyScreen /></Suspense>;
}
