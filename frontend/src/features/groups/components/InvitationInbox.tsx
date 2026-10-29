"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { api } from "@/core/api/client";
import { db } from "@/core/db/db";
import { withBase } from "@/core/config";
import { useOnlineIdentity } from "@/features/identity/hooks/useOnlineIdentity";
import { Button, Card, TextField } from "@/design/components";
import { t } from "@/i18n/vi";

interface Invitation { invite_id: string; space_name: string; space_kind: "FAMILY" | "GROUP"; inviter_display_name: string; expires_at: string; }

export function InvitationInbox() {
  const router = useRouter();
  const client = useQueryClient();
  const identity = useOnlineIdentity();
  const enabled = useLiveQuery(async () => (await db.settings.get("online.enabled"))?.value === true, []);
  const query = useQuery({ queryKey: ["my-invitations", identity?.actorId], queryFn: () => api<{ invitations: Invitation[] }>("GET", "/me/invitations"), enabled: enabled === true && !!identity, refetchInterval: 30_000 });
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const decide = async (invitation: Invitation, accept: boolean) => {
    setBusy(invitation.invite_id); setError("");
    try {
      if (accept) {
        const response = await api<{ request_id: string }>("POST", `/me/invitations/${invitation.invite_id}/accept`, { display_name: name.trim() });
        sessionStorage.setItem("fc.joinRequest", response.request_id); sessionStorage.setItem("fc.joinSpaceKind", invitation.space_kind); router.push("/tham-gia/");
      } else await api("POST", `/me/invitations/${invitation.invite_id}/decline`);
      await client.invalidateQueries({ queryKey: ["my-invitations"] });
    } catch { setError(t("sharing.error")); } finally { setBusy(undefined); }
  };
  const linkForm = <>
    <p className="text-sm text-body">{t("groups.invitationHint")}</p>
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault(); setError("");
      try { const url = new URL(link, location.origin); if (url.origin !== location.origin || url.pathname !== withBase("/tham-gia/")) throw new Error("INVALID_INVITATION"); router.push("/tham-gia/" + url.search + url.hash); }
      catch { setError(t("groups.invalidInvitation")); }
    }}><TextField label={t("groups.invitationLink")} value={link} type="url" onChange={(e) => setLink(e.target.value)} maxLength={2000} /><Button type="submit" variant="secondary" disabled={!link.trim()} className="self-start">{t("groups.openInvitation")}</Button></form>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </>;
  // Most visitors here are inviting, not joining: keep the paste-a-link form out of the way until someone has invitations.
  if (!query.data?.invitations.length && !query.isError) return <details className="rounded-card border border-border bg-surface p-4">
    <summary className="cursor-pointer text-sm font-semibold text-primary">{t("groups.haveInvitation")}</summary>
    <div className="mt-4 flex flex-col gap-4">{linkForm}</div>
  </details>;
  return <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("groups.invitations")}</h2>
    {query.isError && <p role="alert" className="text-sm text-danger">{t("sharing.error")}</p>}
    {!!query.data?.invitations.length && <TextField label={t("groups.selfName")} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />}
    {query.data?.invitations.map((invitation) => <div key={invitation.invite_id} className="flex flex-col gap-3 border-b border-border pb-4"><div><h3 className="break-words font-semibold text-text">{invitation.space_name}</h3><p className="text-sm text-body">{invitation.inviter_display_name} · {new Date(invitation.expires_at).toLocaleString("vi-VN")}</p></div><div className="flex flex-wrap gap-2"><Button disabled={!name.trim() || !!busy} onClick={() => void decide(invitation, true)}>{t("groups.accept")}</Button><Button variant="secondary" disabled={!!busy} onClick={() => void decide(invitation, false)}>{t("sharing.reject")}</Button></div></div>)}
    {linkForm}
  </Card>;
}
