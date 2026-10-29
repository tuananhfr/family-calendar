"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";
import { currentOnlineIdentity } from "@/core/db/online-identity";
import type { Space } from "@/core/model/space";
import { isEmergencyRecord } from "@/core/emergency/model";
import { readEmergencyViews, recordFromView } from "@/core/emergency/api";

export function useEmergencyEvents(space: Space | undefined, actorId: string | undefined) {
  const [refreshFailed, setRefreshFailed] = useState(false);
  const rows = useLiveQuery(async () => space ? (await db.emergencyEvents.where("spaceId").equals(space.id).toArray()).filter(isEmergencyRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [], [space?.id]);
  const id = space?.id;
  const shared = space?.sharingState === "SHARED";
  useEffect(() => {
    if (!id || !shared || !actorId) return;
    let live = true;
    let pending = false;
    const refresh = async () => {
      if (!live || pending || !navigator.onLine || document.visibilityState === "hidden" || currentOnlineIdentity()?.actorId !== actorId || (await db.settings.get("online.enabled"))?.value !== true || (await db.syncCursors.get(id))?.halt) return;
      pending = true;
      try {
        const views = await readEmergencyViews(id);
        if (!live) return;
        await db.transaction("rw", [db.emergencyEvents, db.emergencyQueue, db.spaces, db.syncCursors], async () => {
          const currentSpace = await db.spaces.get(id);
          if (!live || currentOnlineIdentity()?.actorId !== actorId || !currentSpace || currentSpace.deletedAt || currentSpace.sharingState !== "SHARED" || (await db.syncCursors.get(id))?.halt) return;
          const ids = new Set(views.map((view) => view.id));
          for (const row of await db.emergencyEvents.where("spaceId").equals(id).toArray()) if (isEmergencyRecord(row) && row.createdByActorId !== actorId && !ids.has(row.id)) await db.emergencyEvents.delete(row.id);
          for (const view of views) {
            const previous = await db.emergencyEvents.get(view.id);
            const local = isEmergencyRecord(previous) ? previous : undefined;
            const incoming = recordFromView(view, id);
            const queued = await db.emergencyQueue.get(`${view.id}:RECONCILE`);
            if (queued && local?.status !== "ACTIVE" && incoming.status === "ACTIVE" && local) { incoming.status = local.status; incoming.closedAt = local.closedAt; }
            if (queued && local) incoming.delivery = local.delivery;
            if (local?.position && incoming.status === "ACTIVE" && await db.emergencyQueue.get(`${view.id}:LOCATION`)) incoming.position = local.position;
            incoming.serverClosedConfirmedAt = incoming.status !== "ACTIVE" && view.lifecycle !== "ACTIVE" ? local?.serverClosedConfirmedAt ?? new Date().toISOString() : local?.serverClosedConfirmedAt;
            await db.emergencyEvents.put({ ...incoming, deviceId: local?.deviceId ?? "" });
          }
        });
        if (live) setRefreshFailed(false);
      } catch {
        if (live) setRefreshFailed(true);
      } finally { pending = false; }
    };
    const start = () => void refresh();
    start();
    const timer = setInterval(start, 5000);
    window.addEventListener("online", start);
    document.addEventListener("visibilitychange", start);
    return () => { live = false; clearInterval(timer); window.removeEventListener("online", start); document.removeEventListener("visibilitychange", start); };
  }, [id, shared, actorId]);
  return { events: (rows ?? []).filter((row) => row.spaceId === space?.id), loading: rows === undefined, refreshFailed };
}
