"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import { PageHeader, Tabs } from "@/design/components";
import { t } from "@/i18n/vi";
import { AccountPanel } from "@/features/identity/components/AccountPanel";
import { SharingPanel } from "@/features/sharing/components/SharingPanel";
import { DataTab } from "./DataTab";
import { NotificationsTab } from "./NotificationsTab";

const TABS = { notifications: "NOTIFICATIONS", data: "DATA", account: "ACCOUNT", sharing: "SHARING" } as const;
type TabParam = keyof typeof TABS;

/** `/cai-dat` (modules.md §16); `?tab=` keeps deep links such as "Xuất lịch (ICS/PDF)" from the sidebar. */
export function SettingsPage() {
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
        value={tab}
        onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
        items={(Object.keys(TABS) as TabParam[]).map((k) => ({ value: k, label: k === "account" ? t("sharing.account") : k === "sharing" ? t("sharing.title") : t(`settings.tabs.${TABS[k]}`) }))}
      />
      {tab === "data" ? <DataTab /> : tab === "account" ? <AccountPanel /> : tab === "sharing" ? <SharingPanel /> : <NotificationsTab />}
    </div>
  );
}
