"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Siren } from "lucide-react";
import { hasLevel } from "@/core/access/evaluate";
import { createEmergency } from "@/core/emergency/persist";
import { Button, Card, Dialog, Skeleton } from "@/design/components";
import { useAccess, useActiveSpace } from "@/features/members";
import { t } from "@/i18n/vi";
import { useEmergencyEvents } from "../hooks/useEmergencyEvents";
import { EmergencyContacts } from "./EmergencyContacts";
import { EmergencyRecipients } from "./EmergencyRecipients";
import { EmergencyStatus } from "./EmergencyStatus";

export function EmergencyScreen() {
  const { space, spaces, loading, setActive } = useActiveSpace();
  const access = useAccess();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [requestedEvent, setRequestedEvent] = useState<string>();
  const query = useSearchParams();
  const requestedSpace = query.get("space");
  useEffect(() => {
    if (requestedSpace && spaces.some((candidate) => candidate.id === requestedSpace && candidate.kind === "FAMILY") && space?.id !== requestedSpace) setActive(requestedSpace);
  }, [spaces, space?.id, setActive, requestedSpace]);
  const family = space?.kind === "FAMILY" ? space : undefined;
  const { events, loading: eventsLoading, refreshFailed } = useEmergencyEvents(family, access?.actorId);
  const canTrigger = !!family && !!access && hasLevel(access, "sos.trigger", "EDIT");
  const active = events.some((event) => event.status === "ACTIVE" && event.createdByActorId === access?.actorId);
  const highlighted = requestedEvent ?? query.get("event");
  const visible = [...events].sort((a, b) => Number(b.id === highlighted) - Number(a.id === highlighted));
  return <div className="flex flex-col gap-5">
    <header className="flex flex-col gap-2"><h1 className="flex items-center gap-3 text-2xl font-bold text-danger"><Siren aria-hidden className="size-8" />{t("emergency.title")}</h1><p className="text-body">{t("emergency.intro")}</p><Link href="/hom-nay/" className="self-start text-sm font-semibold text-primary underline">{t("emergency.back")}</Link></header>
    {loading ? <Skeleton className="h-24" /> : !family ? <Card><p className="mb-3 text-body">{t("emergency.familyOnly")}</p><div className="flex flex-wrap gap-2">{spaces.filter((candidate) => candidate.kind === "FAMILY").map((candidate) => <Button key={candidate.id} onClick={() => setActive(candidate.id)}>{candidate.name}</Button>)}</div></Card> : <>
      {!active && <Button variant="danger" size="lg" block disabled={!canTrigger || busy} onClick={() => setConfirm(true)}>{t("emergency.trigger")}</Button>}
      {!canTrigger && <p className="text-sm text-body">{t("emergency.noPermission")}</p>}
      {error && <p role="alert" className="text-danger">{t("emergency.persistFailed")}</p>}
      {refreshFailed && <p role="status" className="text-sm text-body">{t("emergency.refreshFailed")}</p>}
      {eventsLoading ? <Skeleton className="h-32" /> : visible.length && access ? visible.map((event) => <EmergencyStatus key={event.id} event={event} actorId={access.actorId} />) : <p className="text-sm text-muted">{t("emergency.noEvents")}</p>}
      <p className="text-sm text-muted">{t("emergency.runtime")}</p>
      <EmergencyContacts key={family.id} spaceId={family.id} />
      <EmergencyRecipients key={family.id + ":recipients"} spaceId={family.id} shared={family.sharingState === "SHARED" && !!access} canManage={!!access && hasLevel(access, "members", "EDIT")} />
    </>}
    {!loading && !family && <EmergencyContacts />}
    <Dialog open={confirm} onOpenChange={setConfirm} title={t("emergency.confirmTitle")} size="sm" footer={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>{t("common.cancel")}</Button><Button variant="danger" loading={busy} disabled={!canTrigger} onClick={async () => {
      if (!family || !access) return;
      setBusy(true); setError(false);
      try { const event = await createEmergency(family, access); setRequestedEvent(event.id); setConfirm(false); window.dispatchEvent(new Event("emergency-persisted")); }
      catch { setError(true); setConfirm(false); } finally { setBusy(false); }
    }}>{t("emergency.confirm")}</Button></>}><p className="text-sm text-body">{t("emergency.confirmBody")}</p></Dialog>
  </div>;
}
