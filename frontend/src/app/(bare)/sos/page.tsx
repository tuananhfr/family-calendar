import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { ComingSoonScreen } from "@/features/coming-soon/ComingSoonScreen";
import { SCREENS } from "@/features/coming-soon/screens";

export const metadata: Metadata = { title: t(SCREENS.sos.titleKey) };

export default function SosPage() {
  return <ComingSoonScreen screen="sos" />;
}
