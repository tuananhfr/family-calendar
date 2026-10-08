"use client";
import { sharingError } from "@/features/sharing/model/errors";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/core/api/client";
import { Button, TextField } from "@/design/components";
import { t } from "@/i18n/vi";
import { db } from "@/core/db/db";
import { useAppStore } from "@/store/app.store";
import { ensureLocalSession, refreshSession } from "../model/session";
export function EmailForm({ mode }: { mode: "login" | "link" }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const options = useQuery({ queryKey: ["identity-options"], queryFn: () => api<{ email_configured: boolean }>("GET", "/auth/options") });
  const dev = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);
  const available = options.data?.email_configured || dev;
  return <form className="flex flex-col gap-4" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError(undefined); setMessage(undefined);
    try {
      if (mode === "link") {
        const active = await db.spaces.get(useAppStore.getState().activeSpaceId ?? "");
        if (active?.sharingState === "SHARED") await refreshSession(); else await ensureLocalSession();
      }
      await api("POST", mode === "link" ? "/auth/magic-link" : "/auth/login", { email });
      setMessage(t("sharing.sent"));
    } catch (err) { setError(sharingError(err)); }
    finally { setBusy(false); }
  }}>
    <p className="text-sm text-body">{t(mode === "login" ? "sharing.loginHint" : "sharing.linkHint")}</p>
    {options.data && !options.data.email_configured ? <p className="text-sm text-muted" role="status">{t(dev ? "sharing.mailDev" : "sharing.mailUnavailable")}</p> : null}
    {options.isError ? <p className="text-sm text-danger" role="alert">{t("sharing.error")}</p> : null}
    <TextField label={t("sharing.email")} type="email" autoComplete="email" maxLength={254} required value={email} onChange={(e) => setEmail(e.target.value)} />
    <Button type="submit" loading={busy} disabled={!available || !email.trim()}>{t(mode === "login" ? "sharing.sendLogin" : "sharing.linkEmail")}</Button>
    {message ? <p className="text-sm text-primary" role="status">{message}</p> : null}
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
  </form>;
}
