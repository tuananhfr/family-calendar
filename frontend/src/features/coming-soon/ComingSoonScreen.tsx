import { t } from "@/i18n/vi";
import { Card, EmptyState, PageHeader } from "@/design/components";
import { SCREENS, type ScreenKey } from "./screens";

/** Placeholder until the feature task for this route lands; keeps navigation and layout testable. */
export function ComingSoonScreen({ screen }: { screen: ScreenKey }) {
  const meta = SCREENS[screen];
  const Icon = meta.icon;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(meta.titleKey)} icon={<Icon />} illustration={meta.illustration} />
      <Card>
        <EmptyState title={t(meta.titleKey)} body={t("common.comingSoon")} illustration={meta.illustration} />
      </Card>
    </div>
  );
}
