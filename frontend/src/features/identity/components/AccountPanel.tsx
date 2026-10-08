"use client";
import { sharingError } from "@/features/sharing/model/errors";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Smartphone } from "lucide-react";
import { api } from "@/core/api/client";
import { Button, buttonClass } from "@/design/components";
import { t } from "@/i18n/vi";
import { SettingsPanel } from "@/features/settings/components/SettingsPanel";
import { useActiveSpace } from "@/features/members/hooks/useActiveSpace";
import { useOnlineIdentity } from "../hooks/useOnlineIdentity";
import { logout } from "../model/session";
import { EmailForm } from "./EmailForm";
type Device = { id: string; label: string | null; status: string; current: boolean };
export function AccountPanel() {
  const identity = useOnlineIdentity();
  const client = useQueryClient();
  const { space } = useActiveSpace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [code, setCode] = useState("");
  const account = useQuery({ queryKey: ["account", identity?.actorId], queryFn: () => api<{ linked: boolean; email?: string }>("GET", "/account"), enabled: !!identity });
  const devices = useQuery({ queryKey: ["devices", identity?.actorId], queryFn: () => api<{ devices: Device[] }>("GET", "/devices"), enabled: !!identity });
  const run = async (action: () => Promise<unknown>) => {
    setError(undefined); setBusy(true); try { await action(); await client.invalidateQueries({ queryKey: ["devices"] }); }
    catch (err) { setError(sharingError(err)); } finally { setBusy(false); }
  };
  return <div className="grid gap-4 lg:grid-cols-2">
    <SettingsPanel icon={<Mail />} title={t("sharing.account")}>
      {account.data?.linked ? <p className="break-all text-sm text-primary">{t("sharing.emailVerified")}: {account.data.email}</p> : <EmailForm mode="link" />}
      <Link href="/dang-nhap/" className={buttonClass("secondary")}>{t("sharing.login")}</Link>
      {identity ? <><p className="text-xs text-muted">{t("sharing.logoutHint")}</p><Button disabled={busy} variant="ghost" onClick={() => void run(logout)}>{t("sharing.logout")}</Button></> : null}
    </SettingsPanel>
    <SettingsPanel icon={<Smartphone />} title={t("sharing.devices")}>
      {devices.data?.devices.filter((d) => d.status === "ACTIVE").map((d) => <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
        <span className="min-w-0 break-words text-sm text-text">{d.label ?? "Browser"} {d.current ? "· " + t("sharing.currentDevice") : ""}</span>
        {!d.current ? <Button disabled={busy} size="sm" variant="ghost" onClick={() => { if (window.confirm(t("sharing.confirmRevoke"))) void run(() => api("POST", "/devices/" + d.id + "/revoke")); }}>{t("sharing.revokeDevice")}</Button> : null}
      </div>) ?? <p className="text-sm text-muted">{t("sharing.none")}</p>}
      {space?.sharingState === "SHARED" ? <><Button disabled={busy} variant="secondary" onClick={() => void run(async () => setCode((await api<{ code: string }>("POST", "/spaces/" + space.id + "/recovery-codes")).code))}>{t("sharing.createCode")}</Button><p className="text-xs text-muted">{t("sharing.recoveryHint")}</p>{code ? <code className="break-all rounded-control bg-primary-soft p-3 text-primary">{code}</code> : null}</> : null}
      <Link href="/khoi-phuc/" className="text-sm text-primary underline">{t("sharing.recover")}</Link>
    </SettingsPanel>
    {error ? <p className="text-sm text-danger lg:col-span-2" role="alert">{error}</p> : null}
  </div>;
}
