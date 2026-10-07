"use client";

import { useCallback, useEffect, useState } from "react";
import { detectCapabilities, type Capabilities } from "@/core/platform/capabilities";
import { requestNotificationPermission } from "@/core/platform/notification-permission";

/** The real permission state, re-read when the tab comes back (the user may have changed it in site settings). */
export function useNotificationPermission(): { caps: Capabilities | null; request: () => Promise<void> } {
  const [caps, setCaps] = useState<Capabilities | null>(null);

  useEffect(() => {
    let live = true;
    const read = () => void detectCapabilities().then((c) => live && setCaps(c));
    read();
    const onVisible = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const request = useCallback(async () => {
    await requestNotificationPermission();
    setCaps(await detectCapabilities());
  }, []);

  return { caps, request };
}
