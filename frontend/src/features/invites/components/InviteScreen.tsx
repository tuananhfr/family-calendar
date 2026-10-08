"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/client";
import { Card, Button, SkeletonList } from "@/design/components";
import { t } from "@/i18n/vi";
import { CreateInvite } from "./CreateInvite";
import { RequestDecision } from "./RequestDecision";
import { getMemberships, spaceEndpoint, type Invite, type JoinRequest } from "../model/api";
export function InviteScreen({ spaceId, emailMode = false }: { spaceId: string; emailMode?: boolean }) {
  const client = useQueryClient();
  const [error, setError] = useState<string>();
  const invites = useQuery({ queryKey: ["invites", spaceId], queryFn: () => api<{ invites: Invite[] }>("GET", spaceEndpoint(spaceId) + "/invites"), refetchInterval: 10_000 });
  const requests = useQuery({ queryKey: ["join-requests", spaceId], queryFn: () => api<{ requests: JoinRequest[] }>("GET", spaceEndpoint(spaceId) + "/join-requests"), refetchInterval: 5_000 });
  const memberships = useQuery({ queryKey: ["memberships", spaceId], queryFn: () => getMemberships(spaceId) });
  if (invites.isPending || requests.isPending || memberships.isPending) return <SkeletonList rows={3} />;
  if (invites.isError || requests.isError || memberships.isError) return <p className="text-sm text-danger" role="alert">{t("sharing.error")}</p>;
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["invites", spaceId] }), client.invalidateQueries({ queryKey: ["join-requests", spaceId] }), client.invalidateQueries({ queryKey: ["memberships", spaceId] })]);
  const pending = requests.data.requests.filter((r) => r.status === "PENDING");
  return <div className="grid min-w-0 gap-5 lg:grid-cols-2">
    <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("sharing.invite")}</h2><CreateInvite spaceId={spaceId} emailMode={emailMode} /></Card>
    <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("sharing.requests")}</h2>
      {pending.length ? pending.map((request) => <RequestDecision key={request.request_id} spaceId={spaceId} request={request} roles={memberships.data.roles} onDecided={refresh} />) : <p className="text-sm text-muted">{t("sharing.noRequests")}</p>}
    </Card>
    <Card className="flex flex-col gap-3 lg:col-span-2"><h2 className="font-bold text-text">{t("sharing.inviteList")}</h2>
      {invites.data.invites.length ? invites.data.invites.map((invite) => <div key={invite.invite_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
        <div className="min-w-0 text-sm text-body"><p>{t("sharing." + invite.status)} · {invite.uses}/{invite.max_uses}</p><p className="break-all text-xs text-muted">{invite.email ?? ""} {new Date(invite.expires_at).toLocaleString("vi-VN")}</p></div>
        {invite.status === "ACTIVE" ? <Button size="sm" variant="ghost" onClick={async () => {
          if (!window.confirm(t("sharing.confirmInviteRevoke"))) return;
          try { await api("POST", spaceEndpoint(spaceId) + "/invites/" + invite.invite_id + "/revoke"); await refresh(); } catch { setError(t("sharing.error")); }
        }}>{t("sharing.revokeInvite")}</Button> : null}
      </div>) : <p className="text-sm text-muted">{t("sharing.none")}</p>}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    </Card>
  </div>;
}
