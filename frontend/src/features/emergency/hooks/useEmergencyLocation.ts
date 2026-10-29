"use client";
import { useEffect, useState } from "react";
import type { EmergencyRecord } from "@/core/emergency/model";
import { saveEmergencyPosition } from "@/core/emergency/persist";

export function useEmergencyLocation(event: EmergencyRecord | undefined, actorId: string | undefined, consent: boolean) {
  const [watching, setWatching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const id = event?.id;
  const active = event?.status === "ACTIVE";
  const owned = event?.createdByActorId === actorId;
  useEffect(() => {
    let watcher: number | undefined;
    let mounted = true;
    const stop = () => {
      if (watcher !== undefined) navigator.geolocation.clearWatch(watcher);
      watcher = undefined;
      setWatching(false);
    };
    const update = () => {
      stop();
      const visible = document.visibilityState === "visible";
      setForeground(visible);
      if (!visible || !consent || !active || !owned || !id || !actorId) return;
      if (!navigator.geolocation) { setFailed(true); return; }
      setFailed(false);
      watcher = navigator.geolocation.watchPosition((position) => {
        if (!mounted || document.visibilityState !== "visible") return;
        const age = Date.now() - position.timestamp;
        void saveEmergencyPosition(id, actorId, { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString(), provenance: age >= 0 && age <= 60_000 ? "CURRENT" : "LAST_KNOWN" })
          .then(() => { if (mounted) window.dispatchEvent(new Event("emergency-persisted")); })
          .catch(() => { if (mounted) setFailed(true); });
      }, () => { if (mounted) { setFailed(true); stop(); } }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
      setWatching(true);
    };
    update();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pagehide", stop);
    return () => { mounted = false; if (watcher !== undefined) navigator.geolocation.clearWatch(watcher); clearInterval(timer); document.removeEventListener("visibilitychange", update); window.removeEventListener("pagehide", stop); };
  }, [id, active, owned, actorId, consent]);
  return { watching, failed, foreground, now };
}
