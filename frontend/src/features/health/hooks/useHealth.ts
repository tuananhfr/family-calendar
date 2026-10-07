"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { canRead, hasLevel } from "@/core/access/evaluate";
import { DEFAULT_TIME_ZONE } from "@/core/model/common";
import type { HealthMetric, HealthNote, HealthProfile } from "@/core/model/health";
import type { Member } from "@/core/model/member";
import { listActive } from "@/core/repo/read";
import { addDays, type LocalDate } from "@/core/time/local-date";
import { instantToZoned, type LocalDateTime } from "@/core/time/zoned";
import { useOccurrences, type OccurrenceEntry } from "@/features/items";
import { useAccess, useActiveSpace, useMembers } from "@/features/members";
import { isAppointment, isMedication } from "../model/health-view";

/** Far enough to show "Tiêm cúm" booked a couple of months out. */
const LOOKAHEAD_DAYS = 90;

export interface HealthData {
  loading: boolean;
  /** No `health` VIEW for the active role: the screen shows ForbiddenState and reads nothing. */
  forbidden: boolean;
  canEdit: boolean;
  spaceId?: string;
  today: LocalDate;
  now: LocalDateTime;
  members: Member[];
  profiles: HealthProfile[];
  metrics: HealthMetric[];
  notes: HealthNote[];
  /** Medication and health-event occurrences from today on; medication items are visible to their creator only. */
  entries: OccurrenceEntry[];
  medicationItems: OccurrenceEntry["item"][];
}

function useNow(timeZone: string): LocalDateTime {
  const [now, setNow] = useState(() => instantToZoned(new Date(), timeZone));
  useEffect(() => {
    // Dose status flips at minute boundaries ("Sắp đến giờ" → "Bỏ lỡ").
    const tick = () => setNow(instantToZoned(new Date(), timeZone));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timeZone]);
  return now;
}

export function useHealth(): HealthData {
  const { space } = useActiveSpace();
  const spaceId = space?.id;
  const now = useNow(space?.timeZone ?? DEFAULT_TIME_ZONE);
  const today = now.slice(0, 10);
  const access = useAccess();
  const members = useMembers(spaceId);
  const allowed = access ? hasLevel(access, "health", "VIEW") : false;
  const window = useMemo(() => (allowed ? { from: today, to: addDays(today, LOOKAHEAD_DAYS) } : null), [allowed, today]);
  const occ = useOccurrences(window);
  const data = useLiveQuery(
    async () =>
      spaceId && allowed
        ? {
            profiles: await listActive<HealthProfile>("health_profile", spaceId),
            metrics: await listActive<HealthMetric>("health_metric", spaceId),
            notes: await listActive<HealthNote>("health_note", spaceId),
          }
        : null,
    [spaceId, allowed],
  );

  return useMemo(() => {
    const empty = { spaceId, today, now, members: [], profiles: [], metrics: [], notes: [], entries: [], medicationItems: [] };
    if (!access || !members) return { loading: true, forbidden: false, canEdit: false, ...empty };
    if (!allowed) return { loading: false, forbidden: true, canEdit: false, ...empty };
    if (!data || occ.loading) return { loading: true, forbidden: false, canEdit: false, ...empty };
    const readable = <T extends HealthProfile | HealthMetric | HealthNote>(rows: T[]) => rows.filter((r) => canRead(access, r, "health"));
    return {
      loading: false,
      forbidden: false,
      canEdit: hasLevel(access, "health", "EDIT"),
      spaceId,
      today,
      now,
      members: members.filter((m) => m.status === "ACTIVE"),
      profiles: readable(data.profiles),
      metrics: readable(data.metrics),
      notes: readable(data.notes),
      entries: occ.entries.filter((e) => isMedication(e.item) || isAppointment(e.item)),
      medicationItems: occ.items.filter(isMedication),
    };
  }, [access, members, allowed, data, occ, spaceId, today, now]);
}
