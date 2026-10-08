"use client";
import Link from "next/link";
import { useState } from "react";
import { Cloud } from "lucide-react";
import { sharingError } from "../model/errors";
import { useSyncStatus } from "@/core/sync/sync-status";
import { syncSpace } from "@/core/sync/sync-engine";
import { createHttpTransport } from "@/core/sync/http-transport";
import { Button, buttonClass } from "@/design/components";
import { SettingsPanel } from "@/features/settings/components/SettingsPanel";
import { t } from "@/i18n/vi";
import { ConflictPanel } from "./ConflictPanel";
import { MediaPanel } from "./MediaPanel";
import { DraftsPanel } from "./DraftsPanel";
const LABELS = { SYNCED: "synced", SYNCING: "progress", PENDING: "waiting", OFFLINE: "offline", CONFLICT: "conflicts", BLOCKED: "blocked", AUTH_REQUIRED: "authRequired" } as const;
export function SyncPanel({ spaceId }: { spaceId: string }) {
  const status = useSyncStatus(spaceId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return <SettingsPanel icon={<Cloud />} title={t("sharing.shared")}>
    <p className="text-sm text-body" role="status">{t("sharing." + LABELS[status.state])}{status.pending ? " (" + status.pending + ")" : ""}</p>
    {status.state === "AUTH_REQUIRED" ? <Link href="/dang-nhap/" className={buttonClass()}>{t("sharing.login")}</Link> : <Button loading={busy} disabled={status.state === "BLOCKED"} variant="secondary" onClick={async () => {
      setBusy(true); setError(undefined);
      try { await syncSpace(spaceId, createHttpTransport(), () => new Date(), true); }
      catch (err) { setError(sharingError(err)); } finally { setBusy(false); }
    }}>{t("sharing.sync")}</Button>}
    <Link href="/thanh-vien/them/?tab=link" className={buttonClass()}>{t("sharing.invite")}</Link>
    <Link href="/quyen/" className={buttonClass("secondary")}>{t("sharing.permissions")}</Link>
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    <MediaPanel spaceId={spaceId} />
    <DraftsPanel />
    <ConflictPanel spaceId={spaceId} />
  </SettingsPanel>;
}
