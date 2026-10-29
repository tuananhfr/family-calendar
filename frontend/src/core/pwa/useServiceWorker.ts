"use client";

import { useEffect, useState } from "react";
import { registerServiceWorker } from "./register";

export function useServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    let registration: ServiceWorkerRegistration | null = null;
    let installing: ServiceWorker | null = null;
    const read = () => {
      if (!live) return;
      if (installing?.state === "redundant" && !registration?.active) setError(true);
      if (navigator.serviceWorker.controller) setWaiting(registration?.waiting ?? null);
    };
    const onUpdate = () => {
      installing?.removeEventListener("statechange", read);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", read);
    };
    void registerServiceWorker().then((result) => {
      if (!live || !result) return;
      registration = result;
      read(); onUpdate();
      registration.addEventListener("updatefound", onUpdate);
    }).catch(() => live && setError(true));
    return () => { live = false; registration?.removeEventListener("updatefound", onUpdate); installing?.removeEventListener("statechange", read); };
  }, []);
  return { waiting, error };
}
