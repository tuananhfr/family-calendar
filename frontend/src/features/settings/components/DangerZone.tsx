"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { Button, Dialog, TextField, toast } from "@/design/components";
import { withBase } from "@/core/config";
import { t } from "@/i18n/vi";
import { pendingChangeCount, wipeLocalData } from "../model/wipe-local";
import { SettingsPanel } from "./SettingsPanel";

/** Two steps (explain, then type XÓA) because this cannot be undone; it only touches this browser. */
export function DangerZone({ onBackupFirst }: { onBackupFirst: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useLiveQuery(() => pendingChangeCount(), []) ?? 0;
  const word = t("settings.danger.confirmWord");

  const close = () => {
    setStep(0);
    setTyped("");
  };

  const wipe = async () => {
    setBusy(true);
    try {
      await wipeLocalData();
      // A full load, not a client navigation: every hook still holds the deleted database.
      window.location.replace(withBase("/bat-dau/"));
    } catch {
      setBusy(false);
      toast(t("settings.danger.failed"), "error");
    }
  };

  return (
    <SettingsPanel id="danger" tone="danger" icon={<Trash2 />} title={t("settings.danger.title")} body={t("settings.danger.body")}>
      <Button variant="danger" className="self-start" icon={<Trash2 className="size-4" />} onClick={() => setStep(1)}>
        {t("settings.danger.open")}
      </Button>
      <Dialog
        open={step === 1}
        onOpenChange={(o) => (o ? setStep(1) : close())}
        title={t("settings.danger.step1Title")}
        description={t("settings.danger.step1Body")}
        icon={<Trash2 />}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                close();
                onBackupFirst();
              }}
            >
              {t("settings.danger.backupFirst")}
            </Button>
            <Button variant="danger" onClick={() => setStep(2)}>
              {t("settings.danger.continue")}
            </Button>
          </>
        }
      >
        {pending > 0 ? <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-text">{t("settings.danger.pending", { n: pending })}</p> : null}
      </Dialog>
      <Dialog
        open={step === 2}
        onOpenChange={(o) => (o ? setStep(2) : close())}
        title={t("settings.danger.step2Title")}
        description={t("settings.danger.step2Body")}
        icon={<Trash2 />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={() => void wipe()} loading={busy} disabled={typed.trim().toLocaleUpperCase("vi") !== word}>
              {t("settings.danger.confirm")}
            </Button>
          </>
        }
      >
        <TextField label={t("settings.danger.confirmLabel")} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
      </Dialog>
    </SettingsPanel>
  );
}
