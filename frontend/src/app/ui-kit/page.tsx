import type { Metadata } from "next";
import { UiKitScreen } from "@/features/ui-kit/UiKitScreen";

export const metadata: Metadata = { title: "Bộ giao diện", robots: { index: false } };

export default function UiKitPage() {
  return <UiKitScreen />;
}
