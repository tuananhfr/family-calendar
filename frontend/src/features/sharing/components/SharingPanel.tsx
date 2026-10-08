"use client";
import { sharingError } from "@/features/sharing/model/errors";
import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Share2 } from "lucide-react";
import { db } from "@/core/db/db";
import { enableSharing } from "@/core/sync/bootstrap-client";
import { Button, Checkbox, Select, buttonClass } from "@/design/components";
import { t } from "@/i18n/vi";
import { useActiveSpace } from "@/features/members/hooks/useActiveSpace";
import { useMembers } from "@/features/members/hooks/useMembers";
import { SettingsPanel } from "@/features/settings/components/SettingsPanel";
import { DraftsPanel } from "./DraftsPanel";
import { SyncPanel } from "./SyncPanel";
export function SharingPanel() {
  const { space } = useActiveSpace();
  const members = useMembers(space?.id);
  const journal = useLiveQuery(async () => space ? await db.settings.get("bootstrap:" + space.id) ?? null : null, [space?.id]);
  const [member, setMember] = useState("");
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState(true);
  const [audio, setAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string>();
  if (!space) return null;
  if (space.sharingState === "SHARED") return <SyncPanel spaceId={space.id} />;
  const saved = journal?.value as { options?: { selfMemberId: string; includeFiles: boolean; includeAudio: boolean } } | undefined;
  return <SettingsPanel icon={<Share2 />} title={t("sharing.enable")} body={t("sharing.localHint")}>
    <p className="text-sm text-body">{t("sharing.shareHint")}</p>
    <p className="text-xs text-muted">{t("sharing.requiresEmail")}</p>
    <Link href="/cai-dat/?tab=account" className={buttonClass("secondary")}>{t("sharing.linkEmail")}</Link>
    <Select label={t("sharing.selfMember")} disabled={!!journal} value={saved?.options?.selfMemberId ?? (member || undefined)} onValueChange={setMember} options={(members ?? []).filter((m) => m.status === "ACTIVE").map((m) => ({ value: m.id, label: m.displayName }))} />
    <Checkbox label={t("sharing.includeFiles")} disabled={!!journal} checked={saved?.options?.includeFiles ?? files} onCheckedChange={(v) => setFiles(v === true)} />
    <Checkbox label={t("sharing.includeAudio")} disabled={!!journal} checked={saved?.options?.includeAudio ?? audio} onCheckedChange={(v) => setAudio(v === true)} />
    <p className="text-xs text-muted">{t("sharing.mediaChoiceHint")}</p>
    <Checkbox label={t("sharing.confirmShare")} checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
    <Button loading={busy} disabled={(!journal && !member) || !consent} onClick={async () => {
      setBusy(true); setError(undefined);
      try { await enableSharing(space.id, { selfMemberId: member, includeFiles: files, includeAudio: audio }, (done, total) => setProgress(done + " / " + total)); }
      catch (err) { setError(sharingError(err)); }
      finally { setBusy(false); }
    }}>{t(journal ? "sharing.resume" : "sharing.enable")}</Button>
    {busy ? <p className="text-sm text-primary" role="status">{t("sharing.progress")} {progress}</p> : null}
    <DraftsPanel />
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
  </SettingsPanel>;
}
