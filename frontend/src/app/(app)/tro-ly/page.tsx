import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { ComingSoonScreen } from "@/features/coming-soon/ComingSoonScreen";
import { SCREENS } from "@/features/coming-soon/screens";

export const metadata: Metadata = { title: t(SCREENS.assistant.titleKey) };

export default function AssistantPage() {
  return <ComingSoonScreen screen="assistant" />;
}
