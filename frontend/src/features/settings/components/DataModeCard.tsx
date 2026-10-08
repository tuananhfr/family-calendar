"use client";

import { useActiveSpace } from "@/features/members/hooks/useActiveSpace";
import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { Badge } from "@/design/components";
import { t } from "@/i18n/vi";
import { formatBytes } from "@/core/format/bytes";
import { SettingsPanel } from "./SettingsPanel";

export function DataModeCard() {
  const { space } = useActiveSpace();
  const shared = space?.sharingState === "SHARED";
  const [used, setUsed] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const estimate = navigator.storage?.estimate?.();
    if (!estimate) {
      queueMicrotask(() => live && setUsed(null));
    } else {
      void estimate.then((e) => live && setUsed(e.usage ?? null)).catch(() => live && setUsed(null));
    }
    return () => {
      live = false;
    };
  }, []);

  return (
    <SettingsPanel id="data-mode" icon={<HardDrive />} title={t("settings.dataMode.title")} body={t(shared ? "sharing.shareHint" : "settings.dataMode.localBody")}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge tone="primary">{t(shared ? "sharing.shared" : "settings.dataMode.LOCAL_ONLY")}</Badge>
        {used === undefined ? null : <span className="text-muted">{used === null ? t("settings.dataMode.storageUnknown") : t("settings.dataMode.storageUsed", { used: formatBytes(used) })}</span>}
      </div>
    </SettingsPanel>
  );
}
