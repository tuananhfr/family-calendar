"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_TIME_ZONE } from "@/core/model/common";
import type { LocalDate } from "@/core/time/local-date";
import { todayIn } from "@/core/time/zoned";
import { useActiveSpace } from "./useActiveSpace";

/** "Today" in the Space's time zone, not the device's (Review Focus #3); rechecked each minute to roll over at midnight. */
export function useSpaceToday(): LocalDate {
  const { space } = useActiveSpace();
  const tz = space?.timeZone ?? DEFAULT_TIME_ZONE;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  // tick is the dependency that makes the date re-read the clock each minute.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => todayIn(tz), [tz, tick]);
  return today;
}
