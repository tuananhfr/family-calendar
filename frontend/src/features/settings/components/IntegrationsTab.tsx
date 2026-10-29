"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/client";
import { hasLevel } from "@/core/access/evaluate";
import { Button, Card, TextField } from "@/design/components";
import { useAccess, useActiveSpace } from "@/features/members";
import { t } from "@/i18n/vi";

const PROVIDERS = ["GOOGLE_CALENDAR", "GOOGLE_DRIVE", "ZALO", "GMAIL", "SMS", "OPEN_API"] as const;
interface Integrations { integrations: Array<{ provider: string; status: string; message: string }>; can_manage_ics: boolean; ics_feeds: Array<{ id: string; label: string | null }> }

export function IntegrationsTab() {
  const { space } = useActiveSpace(); const access = useAccess();
  const client = useQueryClient();
  const online = space?.sharingState === "SHARED" && !!access && hasLevel(access, "settings");
  const query = useQuery({ queryKey: ["integrations", space?.id], queryFn: () => api<Integrations>("GET", `/spaces/${space!.id}/integrations`), enabled: online });
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <div className="flex flex-col gap-4"><p className="text-sm text-body">{t("settingsExtra.integrationsHint")}</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{PROVIDERS.map((provider) => <Card key={provider} className="flex flex-col gap-3"><h2 className="font-bold text-text">{t(`settingsExtra.providers.${provider}`)}</h2><p className="text-sm text-body">{query.data?.integrations.find((row) => row.provider === provider)?.message || t("settingsExtra.notConfigured")}</p><Button disabled variant="secondary" className="self-start">{t("settingsExtra.connect")}</Button></Card>)}</div>
    <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("settingsExtra.icsTitle")}</h2><p className="text-sm text-body">{t("settingsExtra.icsHint")}</p>{!online ? <p className="text-sm text-muted">{t("settingsExtra.onlineNeeded")}</p> : query.data?.can_manage_ics && <>
      <form className="flex flex-col gap-3" onSubmit={async (e) => {
        e.preventDefault(); if (!space) return; setBusy(true); setError(false);
        try {
          const created = await api<{ url: string }>("POST", `/spaces/${space.id}/ics-feeds`, { label: label.trim() || undefined, include_child_names: false });
          const parsed = new URL(created.url);
          if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("INVALID_URL");
          setUrl(parsed.href); await client.invalidateQueries({ queryKey: ["integrations", space.id] });
        } catch { setError(true); } finally { setBusy(false); }
      }}><TextField label={t("settingsExtra.icsLabel")} value={label} maxLength={50} onChange={(e) => setLabel(e.target.value)} /><Button type="submit" loading={busy} className="self-start">{t("settingsExtra.createIcs")}</Button></form>
      {url && <div><p className="text-xs text-muted">{t("settingsExtra.newLink")}</p><TextField label={t("settingsExtra.icsTitle")} value={url} readOnly onFocus={(e) => e.target.select()} /></div>}
      <ul className="flex flex-col gap-3">{query.data.ics_feeds.map((feed) => <li key={feed.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><span className="min-w-0 break-words text-sm text-body">{feed.label ?? t("settingsExtra.icsTitle")}</span><Button variant="ghost" disabled={busy} onClick={async () => {
        if (!space || !window.confirm(t("settingsExtra.confirmRevokeIcs"))) return;
        setBusy(true); setError(false);
        try { await api("DELETE", `/spaces/${space.id}/ics-feeds/${feed.id}`); setUrl(""); await client.invalidateQueries({ queryKey: ["integrations", space.id] }); }
        catch { setError(true); } finally { setBusy(false); }
      }}>{t("settingsExtra.revokeIcs")}</Button></li>)}</ul>
    </>}</Card>
    {(error || query.isError) && <p role="alert" className="text-sm text-danger">{t("sharing.error")}</p>}
  </div>;
}
