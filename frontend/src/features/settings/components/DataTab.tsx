"use client";

import { SharingPanel } from "@/features/sharing/components/SharingPanel";
import { BackupPanel } from "./BackupPanel";
import { DangerZone } from "./DangerZone";
import { DataModeCard } from "./DataModeCard";
import { ExportPanel } from "./ExportPanel";
import { RestoreWizard } from "./RestoreWizard";

export function DataTab() {
  const toBackup = () => document.getElementById("backup")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DataModeCard />
      <SharingPanel />
      <ExportPanel />
      <BackupPanel />
      <RestoreWizard />
      <DangerZone onBackupFirst={toBackup} />
    </div>
  );
}
