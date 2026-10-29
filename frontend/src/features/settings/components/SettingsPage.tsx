"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import { PageHeader, Tabs } from "@/design/components";
import { t } from "@/i18n/vi";
import { AccountPanel } from "@/features/identity/components/AccountPanel";
import { SharingPanel } from "@/features/sharing/components/SharingPanel";
import { DataTab } from "./DataTab";
import { NotificationsTab } from "./NotificationsTab";
import { GeneralTab } from "./GeneralTab";
import { AppearanceTab } from "./AppearanceTab";
import { IntegrationsTab } from "./IntegrationsTab";
import { AboutTab } from "./AboutTab";
import { useActiveSpace } from "@/features/members";

const TABS = { general: "general", notifications: "NOTIFICATIONS", appearance: "appearance", data: "DATA", security: "security", integrations: "integrations", about: "about", account: "ACCOUNT", sharing: "SHARING" } as const;
type TabParam = keyof typeof TABS;

/** `/cai-dat` (modules.md §16); `?tab=` keeps deep links such as "Xuất lịch (ICS/PDF)" from the sidebar. */
export function SettingsPage() {
  const { space } = useActiveSpace();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: TabParam = raw && raw in TABS ? (raw as TabParam) : "notifications";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} icon={<Settings />} illustration="corner-settings" />
      <Tabs
        label={t("settings.tabsLabel")}
        value={tab === "account" ? "security" : tab === "sharing" ? "data" : tab}
        onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
        items={(Object.keys(TABS) as TabParam[]).filter((key) => key !== "account" && key !== "sharing").map((key) => ({ value: key, label: key === "notifications" || key === "data" ? t(`settings.tabs.${TABS[key]}`) : t(`settingsExtra.tabs.${key}`) }))}
      />
      {tab === "general" ? <GeneralTab /> : tab === "appearance" ? <AppearanceTab /> : tab === "integrations" ? <IntegrationsTab key={space?.id} /> : tab === "about" ? <AboutTab /> : tab === "data" ? <DataTab /> : tab === "account" || tab === "security" ? <AccountPanel /> : tab === "sharing" ? <SharingPanel key={space?.id} /> : <NotificationsTab />}
    </div>
  );
}
