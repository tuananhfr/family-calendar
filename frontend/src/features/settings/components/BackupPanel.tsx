"use client";

import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { backupFileName, BackupError, exportBackup } from "@/core/backup/export";
import { saveBlob } from "@/core/platform/download";
import { Button, Checkbox, toast } from "@/design/components";
import { useAccess, useActiveSpace } from "@/features/members";
import { t } from "@/i18n/vi";
import { SettingsPanel } from "./SettingsPanel";

export function BackupPanel() {
  const { space } = useActiveSpace();
  const access = useAccess();
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!space || !access) return;
    setBusy(true);
    try {
      const zip = await exportBackup(space.id, { includeAudio, includeFiles, actor: access });
      const name = backupFileName(space.timeZone);
      saveBlob(zip, name);
      toast(t("settings.backup.done", { name }), "success");
    } catch (e) {
      toast(e instanceof BackupError && e.code === "FORBIDDEN" ? t("settings.backup.forbidden") : t("settings.backup.failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPanel id="backup" icon={<ShieldCheck />} title={t("settings.backup.title")} body={t("settings.backup.body")}>
      <div className="flex flex-col gap-2">
        <Checkbox checked={includeAudio} onCheckedChange={setIncludeAudio} label={t("settings.backup.includeAudio")} />
        <Checkbox checked={includeFiles} onCheckedChange={setIncludeFiles} label={t("settings.backup.includeFiles")} />
      </div>
      <Button className="self-start" icon={<Download className="size-4" />} onClick={() => void run()} loading={busy} disabled={!space || !access}>
        {t("settings.backup.now")}
      </Button>
    </SettingsPanel>
  );
}
