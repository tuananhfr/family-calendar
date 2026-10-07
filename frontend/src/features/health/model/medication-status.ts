import type { OccurrenceState } from "@/core/model/occurrence";
import { wallDurationMinutes } from "@/core/recurrence/floating";
import type { Occurrence } from "@/core/recurrence/types";
import type { LocalDateTime } from "@/core/time/zoned";

export type MedicationStatus = "TAKEN" | "DUE_SOON" | "NOT_YET" | "MISSED" | "SKIPPED";

/** modules.md §8; the grace also decides when the foreground scanner records a dose as MISSED. */
export const MEDICATION_WINDOWS = { soonMinutes: 30, graceMinutes: 60 } as const;

/**
 * Today's status of one dose: DONE "Đã uống", from `soonMinutes` before until `graceMinutes` after the time
 * "Sắp đến giờ", earlier "Chưa đến giờ", later "Bỏ lỡ". A snooze does not extend the grace.
 */
export function medicationStatus(
  occ: Pick<Occurrence, "occurrenceKey" | "start" | "allDay">,
  state: Pick<OccurrenceState, "occurrenceKey" | "status"> | undefined,
  now: LocalDateTime,
  opts: { soonMinutes: number; graceMinutes: number } = MEDICATION_WINDOWS,
): MedicationStatus {
  const own = state && state.occurrenceKey === occ.occurrenceKey ? state : undefined;
  if (own?.status === "DONE") return "TAKEN";
  if (own?.status === "SKIPPED") return "SKIPPED";

  if (occ.allDay) {
    const today = now.slice(0, 10);
    if (today < occ.start) return "NOT_YET";
    return today === occ.start ? "DUE_SOON" : "MISSED";
  }
  const minutesUntil = wallDurationMinutes(now, occ.start);
  if (minutesUntil > opts.soonMinutes) return "NOT_YET";
  return -minutesUntil > opts.graceMinutes ? "MISSED" : "DUE_SOON";
}
