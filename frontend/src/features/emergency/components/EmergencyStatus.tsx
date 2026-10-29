"use client";
import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";
import { locationLabel, type EmergencyRecord } from "@/core/emergency/model";
import { closeEmergency, queueEmergencyResponse } from "@/core/emergency/persist";
import { retryEmergencyDelivery } from "@/core/emergency/retry";
import { Button, Card, Checkbox, Dialog, TextArea } from "@/design/components";
import { useMembers } from "@/features/members";
import { t } from "@/i18n/vi";
import { useEmergencyLocation } from "../hooks/useEmergencyLocation";

function localTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

export function EmergencyStatus({ event, actorId }: { event: EmergencyRecord; actorId: string }) {
  const [consent, setConsent] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const own = event.createdByActorId === actorId;
  const active = event.status === "ACTIVE";
  const location = useEmergencyLocation(event, actorId, consent);
  const label = locationLabel(event.position, event.status, location.watching, location.foreground, location.now);
  const members = useMembers(event.spaceId);
  const response = useLiveQuery(() => db.emergencyQueue.get(`${event.id}:RESPONSE`), [event.id]);
  const deliveryKey = event.mode === "LOCAL" ? "local" : event.delivery === "SERVER_ACCEPTED" ? "accepted" : event.delivery === "BLOCKED" ? "blocked" : event.delivery === "FAILED_RETRYABLE" ? "retryable" : "pending";
  const change = async (operation: () => Promise<void>) => {
    setBusy(true); setError(false);
    try { await operation(); window.dispatchEvent(new Event("emergency-persisted")); setEndOpen(false); }
    catch { setError(true); } finally { setBusy(false); }
  };
  return <Card data-testid="emergency-event" data-event-id={event.id} className="flex flex-col gap-4 border-danger">
    <h2 className={`text-xl font-bold ${active ? "text-danger" : "text-text"}`}>{t(`emergency.${active ? "active" : event.status === "CLOSED_SAFE" ? "safe" : "ended"}`)}</h2>
    <p role="status" className="text-sm text-body">{t(`emergency.${deliveryKey}`)}</p>
    {event.mode === "SHARED" && own && ["BLOCKED", "FAILED_RETRYABLE"].includes(event.delivery) && <div className="flex flex-wrap gap-2"><Button variant="secondary" loading={busy} onClick={() => void change(() => retryEmergencyDelivery(event.id, actorId))}>{t("common.retry")}</Button>{event.delivery === "BLOCKED" && <Link href="/dang-nhap/" className="self-center text-sm font-semibold text-primary underline">{t("sharing.login")}</Link>}</div>}
    <dl className="grid gap-2 text-sm text-body"><div><dt className="font-semibold">{t("emergency.triggeredAt")}</dt><dd>{localTime(event.createdAt)}</dd></div>{event.serverReceivedAt && <div><dt className="font-semibold">{t("emergency.receivedAt")}</dt><dd>{localTime(event.serverReceivedAt)}</dd></div>}{event.closedAt && <div><dt className="font-semibold">{t("emergency.closedAt")}</dt><dd>{localTime(event.closedAt)}</dd></div>}</dl>
    {event.reason && <p className="break-words text-sm text-body">{event.reason}</p>}
    {active && own && <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void change(() => closeEmergency(event.id, "CLOSED_SAFE", actorId))}>{t("emergency.safeAction")}</Button><Button variant="secondary" disabled={busy} onClick={() => setEndOpen(true)}>{t("emergency.endAction")}</Button></div>}
    {active && !own && <div className="flex flex-wrap gap-2"><Button disabled={busy || !!response} onClick={() => void change(() => queueEmergencyResponse(event, actorId, "ACKNOWLEDGED"))}>{t("emergency.acknowledgeAction")}</Button><Button variant="secondary" disabled={busy || !!response} onClick={() => void change(() => queueEmergencyResponse(event, actorId, "RESPONDING"))}>{t("emergency.respondAction")}</Button></div>}
    {response && <p role="status" className="text-sm text-body">{t(response.blocked ? "emergency.blocked" : "emergency.responsePending")}</p>}
    {event.mode === "SHARED" && <section className="border-t border-border pt-3"><h3 className="font-bold text-text">{t("emergency.recipients")}</h3>{!event.recipients?.some((row) => row.response !== "NONE") && <p className="mt-2 text-sm text-body">{t("emergency.noResponse")}</p>}<ul className="mt-2 flex flex-col gap-2">{event.recipients?.map((row) => <li key={row.memberId} className="flex flex-wrap justify-between gap-2 text-sm text-body"><span>{members?.find((member) => member.id === row.memberId)?.displayName ?? t("nav.members")}</span><span>{t(`emergency.${row.response === "NONE" ? "responseNone" : row.response === "ACKNOWLEDGED" ? "acknowledged" : "responding"}`)}</span></li>)}</ul></section>}
    <section className="flex flex-col gap-2 border-t border-border pt-3"><h3 className="font-bold text-text">{t("emergency.positionTitle")}</h3>
      {active && own && <><Checkbox checked={consent} onCheckedChange={setConsent} label={t("emergency.consent")} /><p className="text-sm text-muted">{t("emergency.consentHelp")}</p></>}
      <p data-testid="emergency-location-label" className="font-semibold text-body">{t(`emergency.${label === "NONE" ? "noPosition" : label === "LIVE" ? "live" : "lastPosition"}`)}</p>
      {event.position && <><p className="text-sm text-body">{event.position.lat.toFixed(6)}, {event.position.lng.toFixed(6)}</p><p className="text-sm text-body">{t("emergency.positionAt")}: {localTime(event.position.capturedAt)}</p><p className="text-sm text-muted">{t("emergency.accuracy", { n: Math.round(event.position.accuracy) })}</p></>}
      {location.failed && <p role="status" className="text-sm text-body">{t("emergency.gpsFailed")}</p>}
      <p className="text-sm text-muted">{t("emergency.noMaps")}</p>
    </section>
    {error && <p role="alert" className="text-sm text-danger">{t("emergency.operationFailed")}</p>}
    <Dialog open={endOpen} onOpenChange={setEndOpen} title={t("emergency.endTitle")} size="sm" footer={<><Button variant="secondary" disabled={busy} onClick={() => setEndOpen(false)}>{t("common.cancel")}</Button><Button variant="danger" disabled={!reason.trim()} loading={busy} onClick={() => void change(() => closeEmergency(event.id, "CLOSED_ENDED", actorId, reason))}>{t("emergency.endConfirm")}</Button></>}><p className="mb-3 text-sm text-body">{t("emergency.endHelp")}</p><TextArea label={t("emergency.endReason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} required /></Dialog>
  </Card>;
}
