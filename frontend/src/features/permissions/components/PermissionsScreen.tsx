"use client";
import { sharingError } from "@/features/sharing/model/errors";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { api } from "@/core/api/client";
import { createHttpTransport } from "@/core/sync/http-transport";
import { currentOnlineIdentity } from "@/core/db/online-identity";
import { purgeSharedProjection } from "@/core/sync/purge";
import { applySnapshot } from "@/core/sync/snapshot-apply";
import { Button, Card, PageHeader, Select, SkeletonList } from "@/design/components";
import { useActiveSpace } from "@/features/members/hooks/useActiveSpace";
import { SharingPanel } from "@/features/sharing/components/SharingPanel";
import { getMemberships, spaceEndpoint } from "@/features/invites/model/api";
import { t } from "@/i18n/vi";
export function PermissionsScreen() {
  const { space } = useActiveSpace();
  const client = useQueryClient();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const query = useQuery({ queryKey: ["memberships", space?.id], queryFn: () => getMemberships(space!.id), enabled: space?.sharingState === "SHARED" });
  if (!space) return <SkeletonList rows={3} />;
  if (space.sharingState !== "SHARED") return <div className="flex flex-col gap-5"><p className="text-sm text-body">{t("sharing.localPermissions")}</p><SharingPanel /></div>;
  if (query.isPending) return <SkeletonList rows={3} />;
  if (query.isError) return <p className="text-sm text-danger" role="alert">{t("sharing.permissionDenied")}</p>;
  const change = async (actorId: string, remove = false) => {
    setBusy(actorId); setError(undefined);
    try {
      await api("POST", spaceEndpoint(space.id) + "/memberships/" + actorId + (remove ? "/remove" : "/role"), remove ? undefined : { role_id: selected[actorId] });
      await client.invalidateQueries({ queryKey: ["memberships", space.id] });
      if (remove && currentOnlineIdentity()?.actorId === actorId) await purgeSharedProjection(space.id);
      else await applySnapshot(space.id, await createHttpTransport().getSnapshot(space.id));
    } catch (err) { setError(sharingError(err)); } finally { setBusy(undefined); }
  };
  return <div className="flex flex-col gap-5">
    <PageHeader title={t("sharing.permissions")} subtitle={t("sharing.roleHint")} icon={<ShieldCheck />} />
    <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("sharing.memberships")}</h2>
      {query.data.memberships.map((m) => <div key={m.actor_id} className="grid items-end gap-3 border-b border-border pb-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)_auto]">
        <div className="min-w-0"><p className="break-words font-semibold text-text">{m.display_name}</p><p className="text-xs text-muted">{query.data.roles.find((r) => r.id === m.role_id)?.name}</p></div>
        {query.data.can_manage ? <>
          <Select label={t("sharing.role")} value={selected[m.actor_id] ?? m.role_id} onValueChange={(value) => setSelected((s) => ({ ...s, [m.actor_id]: value }))} options={query.data.roles.map((r) => ({ value: r.id, label: r.name }))} />
          <div className="flex flex-wrap gap-2"><Button size="sm" loading={busy === m.actor_id} disabled={!selected[m.actor_id] || selected[m.actor_id] === m.role_id} onClick={() => void change(m.actor_id)}>{t("sharing.changeRole")}</Button>
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => { if (window.confirm(t("sharing.confirmRemove"))) void change(m.actor_id, true); }}>{t("sharing.removeMember")}</Button></div>
        </> : null}
      </div>)}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    </Card>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {query.data.roles.map((role) => <Card key={role.id}><h2 className="mb-3 font-bold text-text">{role.name}</h2>
        <dl className="flex flex-col gap-2">{Object.entries(role.matrix).map(([capability, level]) => <div key={capability} className="flex justify-between gap-3 text-sm"><dt className="text-body">{t("sharing.capabilityLabels." + capability.replaceAll(".", "_"))}</dt><dd className="shrink-0 text-muted">{t("sharing.levelLabels." + level)}</dd></div>)}</dl>
      </Card>)}
    </div>
  </div>;
}
