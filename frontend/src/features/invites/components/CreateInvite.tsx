"use client";
import { sharingError } from "@/features/sharing/model/errors";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/client";
import { withBase } from "@/core/config";
import { Button, TextField, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { spaceEndpoint } from "../model/api";
export function CreateInvite({ spaceId, emailMode }: { spaceId: string; emailMode: boolean }) {
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState(48);
  const [uses, setUses] = useState(1);
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const options = useQuery({ queryKey: ["identity-options"], queryFn: () => api<{ email_configured: boolean }>("GET", "/auth/options"), enabled: emailMode });
  const dev = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);
  return <form className="flex flex-col gap-4" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError(undefined);
    try {
      const created = await api<{ url: string; email_delivery?: string }>("POST", spaceEndpoint(spaceId) + "/invites",
        { expires_in_hours: hours, max_uses: uses, approval_policy: "APPROVAL_REQUIRED", proposed_role: "MEMBER", ...(emailMode ? { email } : {}) });
      const absolute = new URL(withBase(created.url), location.origin).href;
      setLink(absolute);
      const QR = await import("qrcode");
      setQr(await QR.toDataURL(absolute, { width: 256, margin: 2 }));
      if (emailMode && created.email_delivery !== "SENT") setError(t(created.email_delivery === "NOT_CONFIGURED" ? "sharing.mailUnavailable" : "sharing.error"));
      await client.invalidateQueries({ queryKey: ["invites", spaceId] });
    } catch (err) { setError(sharingError(err)); }
    finally { setBusy(false); }
  }}>
    {emailMode ? <><TextField label={t("sharing.email")} type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
      {options.data && !options.data.email_configured ? <p className="text-xs text-muted">{t(dev ? "sharing.mailDev" : "sharing.mailUnavailable")}</p> : null}</> : null}
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label={t("sharing.expires")} type="number" min={1} max={168} required value={hours} onChange={(e) => setHours(Number(e.target.value))} />
      <TextField label={t("sharing.uses")} type="number" min={1} max={20} required value={uses} onChange={(e) => setUses(Number(e.target.value))} />
    </div>
    <Button type="submit" loading={busy} disabled={emailMode && !options.data?.email_configured && !dev}>{t("sharing.createInvite")}</Button>
    {link ? <div className="flex flex-col items-start gap-3 rounded-control bg-primary-soft p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr ? <img src={qr} alt={t("sharing.linkTab")} width={200} height={200} className="max-w-full rounded-control" /> : null}
      <p className="break-all text-sm text-text">{link}</p>
      <p className="text-xs text-muted">{t("sharing.once")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(link); toast(t("sharing.copied"), "success"); } catch { setError(t("sharing.error")); } }}>{t("sharing.copy")}</Button>
        <Button variant="secondary" onClick={async () => { try { if (navigator.share) await navigator.share({ title: t("appName"), url: link }); else { await navigator.clipboard.writeText(link); toast(t("sharing.copied"), "success"); } } catch (err) { if (!(err instanceof DOMException && err.name === "AbortError")) setError(t("sharing.error")); } }}>{t("sharing.share")}</Button>
      </div>
    </div> : null}
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
  </form>;
}
