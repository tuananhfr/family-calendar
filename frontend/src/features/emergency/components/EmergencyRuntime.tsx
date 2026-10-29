"use client";
import { useEffect } from "react";
import { flushEmergencyQueue, purgeExpiredEmergencyPositions } from "@/core/emergency/queue";

export function EmergencyRuntime() {
  useEffect(() => {
    let pending = false;
    const run = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try { await purgeExpiredEmergencyPositions(); await flushEmergencyQueue(); }
      catch { /* A failed local store must not become a network send. */ }
      finally { pending = false; }
    };
    const start = () => void run();
    start();
    const timer = setInterval(start, 5000);
    window.addEventListener("online", start);
    window.addEventListener("emergency-persisted", start);
    document.addEventListener("visibilitychange", start);
    return () => { clearInterval(timer); window.removeEventListener("online", start); window.removeEventListener("emergency-persisted", start); document.removeEventListener("visibilitychange", start); };
  }, []);
  return null;
}
