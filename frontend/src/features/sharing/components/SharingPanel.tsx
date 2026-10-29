"use client";
import { sharingError } from "@/features/sharing/model/errors";
import { useId, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Share2 } from "lucide-react";
import { db } from "@/core/db/db";
import { enableSharing } from "@/core/sync/bootstrap-client";
import { Button, Checkbox, Select, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { useLinkedAccount } from "@/features/identity/hooks/useLinkedAccount";
import { useActiveSpace } from "@/features/members/hooks/useActiveSpace";
import { useMembers } from "@/features/members/hooks/useMembers";
import { SettingsPanel } from "@/features/settings/components/SettingsPanel";
import { DraftsPanel } from "./DraftsPanel";
import { SetupStep } from "./SetupStep";
import { SyncPanel } from "./SyncPanel";
import { VerifyEmailStep } from "./VerifyEmailStep";
export function SharingPanel() {
  const { space } = useActiveSpace();
  const members = useMembers(space?.id);
  const { account } = useLinkedAccount();
  const journal = useLiveQuery(async () => space ? await db.settings.get("bootstrap:" + space.id) ?? null : null, [space?.id]);
  const missingId = useId();
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
  const group = space.kind === "GROUP";
  // FAMILY bootstrap is rejected by the backend without a verified email; GROUP has no such requirement.
  const emailDone = group || account.data?.linked === true;
  const memberDone = !!journal || !!member;
  const missing = [!emailDone && t("sharing.missingEmail"), !memberDone && t("sharing.missingMember"), !consent && t("sharing.missingConsent")].filter(Boolean);
  const step = (n: number) => group ? n - 1 : n;
  return <SettingsPanel icon={<Share2 />} title={t(group ? "groups.enableSharing" : "sharing.enable")} body={t(group ? "groups.groupLocalHint" : "sharing.localHint")}>
    <p className="text-sm text-body">{t(group ? "groups.shareHint" : "sharing.shareHint")}</p>
    {group ? <p className="text-xs text-muted">{t("groups.groupEmail")}</p> : null}
    <ol className="flex flex-col gap-5">
      {group ? null : <SetupStep index={1} title={t("sharing.setupEmail")} done={emailDone}><VerifyEmailStep /></SetupStep>}
      <SetupStep index={step(2)} title={t("sharing.setupWho")} done={memberDone}>
        <Select label={t(group ? "groups.selfMember" : "sharing.selfMember")} disabled={!!journal} value={saved?.options?.selfMemberId ?? (member || undefined)} onValueChange={setMember} options={(members ?? []).filter((m) => m.status === "ACTIVE").map((m) => ({ value: m.id, label: m.displayName }))} />
      </SetupStep>
      <SetupStep index={step(3)} title={t("sharing.setupConsent")} done={consent}>
        <Checkbox label={t("sharing.includeFiles")} disabled={!!journal} checked={saved?.options?.includeFiles ?? files} onCheckedChange={(v) => setFiles(v === true)} />
        <Checkbox label={t("sharing.includeAudio")} disabled={!!journal} checked={saved?.options?.includeAudio ?? audio} onCheckedChange={(v) => setAudio(v === true)} />
        <p className="text-xs text-muted">{t("sharing.mediaChoiceHint")}</p>
        <Checkbox label={t(group ? "groups.shareConsent" : "sharing.confirmShare")} checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
      </SetupStep>
    </ol>
    <Button loading={busy} disabled={missing.length > 0} aria-describedby={missing.length ? missingId : undefined} onClick={async () => {
      setBusy(true); setError(undefined);
      try {
        await enableSharing(space.id, { selfMemberId: member, includeFiles: files, includeAudio: audio }, (done, total) => setProgress(done + " / " + total));
        toast(t(group ? "groups.enabledToast" : "sharing.enabledToast"), "success");
      }
      catch (err) { setError(sharingError(err)); }
      finally { setBusy(false); }
    }}>{t(journal ? "sharing.resume" : group ? "groups.enableSharing" : "sharing.enable")}</Button>
    {missing.length ? <p id={missingId} className="text-xs text-muted">{t("sharing.missing", { items: missing.join(", ") })}</p> : null}
    {busy ? <p className="text-sm text-primary" role="status">{t("sharing.progress")} {progress}</p> : null}
    <DraftsPanel />
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
  </SettingsPanel>;
}
