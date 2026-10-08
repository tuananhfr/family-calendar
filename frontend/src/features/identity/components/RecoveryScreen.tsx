"use client";
import { sharingError } from "@/features/sharing/model/errors";
import { useState } from "react";
import Link from "next/link";
import { api, clearApiSession } from "@/core/api/client";
import { Button, TextField, buttonClass } from "@/design/components";
import { t } from "@/i18n/vi";
import { db } from "@/core/db/db";
import { IdentityFrame } from "./IdentityFrame";
import { importSharedSpaces } from "../model/import-spaces";
import { newOnlineDevice, refreshSession } from "../model/session";
export function RecoveryScreen() {
  const [code, setCode] = useState("");
  const [replacement, setReplacement] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return <IdentityFrame title={t("sharing.recover")}>
    {replacement ? <><p className="text-sm text-body">{t("sharing.newCode")}</p><code className="break-all rounded-control bg-primary-soft p-3 text-lg text-primary">{replacement}</code><p className="text-sm text-muted">{t("sharing.recoveryHint")}</p><Link href="/hom-nay/" className={buttonClass()}>{t("sharing.openFamily")}</Link></> : <form className="flex flex-col gap-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(undefined);
      try {
        if (await db.outbox.filter((o) => o.state !== "ACKNOWLEDGED" && o.state !== "INVALID").count()) throw new Error(t("sharing.pendingLogout"));
        const result = await api<{ code: string }>("POST", "/recovery/redeem", { code, device: newOnlineDevice() });
        clearApiSession(); await refreshSession(); await importSharedSpaces(); setReplacement(result.code);
      } catch (err) { setError(sharingError(err)); }
      finally { setBusy(false); }
    }}><TextField label={t("sharing.recoveryCode")} required maxLength={64} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
      <Button type="submit" loading={busy}>{t("sharing.recover")}</Button></form>}
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
  </IdentityFrame>;
}
