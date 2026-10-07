"use client";

import { useEffect, useState } from "react";

/** Current instant, refreshed every `intervalMs`, so greetings and "việc tiếp theo" roll over without a reload. */
export function useClock(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
