"use client";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ApiRequestError } from "@/core/api/errors";
import { db } from "@/core/db/db";
import { setOnlineIdentity, type OnlineIdentity } from "@/core/db/online-identity";
import { startSyncEngine } from "@/core/sync/sync-engine";
import { purgeSharedProjection } from "@/core/sync/purge";
import { refreshSession, SESSION_KEY } from "@/features/identity/model/session";
export function SyncRuntime() {
  const enabled = useLiveQuery(async () => (await db.settings.get("online.enabled"))?.value === true, []);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, stopEngine: (() => void) | undefined;
    const connect = async () => {
      const cached = (await db.settings.get(SESSION_KEY))?.value as OnlineIdentity | undefined;
      setOnlineIdentity(cached ?? null);
      try {
        const identity = await refreshSession();
        const cursors = await db.syncCursors.toArray();
        for (const cursor of cursors) {
          if (cursor.access?.actorId && cursor.access.actorId !== identity.actorId) await purgeSharedProjection(cursor.spaceId, "IDENTITY_CHANGED");
          else if (cursor.halt === "AUTH_REQUIRED") await db.syncCursors.update(cursor.spaceId, { halt: null });
        }
        if (!stopped) { stopEngine?.(); stopEngine = startSyncEngine(); }
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === "DEVICE_REVOKED") {
          stopEngine?.();
          const spaces = await db.spaces.where("sharingState").equals("SHARED").toArray();
          for (const space of spaces) await purgeSharedProjection(space.id, "DEVICE_REVOKED");
          setOnlineIdentity(null);
          await db.settings.delete(SESSION_KEY);
        } else if (err instanceof ApiRequestError && ["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(err.code)) {
          stopEngine?.();
          for (const cursor of await db.syncCursors.toArray()) await db.syncCursors.update(cursor.spaceId, { halt: "AUTH_REQUIRED" });
        } else if (err instanceof ApiRequestError && err.code === "NETWORK" && !stopped) {
          stopEngine?.(); stopEngine = startSyncEngine();
        }
      }
    };
    void connect();
    const onVisible = () => { if (document.visibilityState === "visible") void connect(); };
    window.addEventListener("online", connect); document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; stopEngine?.(); window.removeEventListener("online", connect); document.removeEventListener("visibilitychange", onVisible); };
  }, [enabled]);
  return null;
}
