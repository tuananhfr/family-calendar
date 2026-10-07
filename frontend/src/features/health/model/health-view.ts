import type { HealthMetric, HealthMetricType } from "@/core/model/health";
import type { Item } from "@/core/model/item";
import type { OccurrenceState } from "@/core/model/occurrence";
import type { Occurrence } from "@/core/recurrence/types";
import { daysBetween, type LocalDate } from "@/core/time/local-date";
import { datePart, timePart, type LocalDateTime } from "@/core/time/zoned";
import { medicationStatus, type MedicationStatus } from "./medication-status";

export const HEALTH_TABS = ["overview", "profiles", "meds", "appointments", "metrics", "report"] as const;
export type HealthTab = (typeof HEALTH_TABS)[number];

interface Entry {
  item: Item;
  occurrence: Occurrence;
  state?: OccurrenceState;
}

export const isMedication = (item: Pick<Item, "kind" | "preset">) => item.kind === "REMINDER" && item.preset === "MEDICATION";
/** Any health event counts, not only the APPOINTMENT preset: "Tiêm cúm" is often saved as a plain event. */
export const isAppointment = (item: Pick<Item, "kind" | "category">) => item.kind === "EVENT" && item.category === "HEALTH";

export interface MedicationRow extends Entry {
  status: MedicationStatus;
}

export function todayMedications(entries: Entry[], today: LocalDate, now: LocalDateTime): MedicationRow[] {
  return entries.filter((e) => isMedication(e.item) && datePart(e.occurrence.start) === today).map((e) => ({ ...e, status: medicationStatus(e.occurrence, e.state, now) }));
}

export interface AppointmentRow extends Entry {
  daysLeft: number;
}

/** Not-yet-passed health events from today on, soonest first; a cancelled one drops out. */
export function upcomingAppointments(entries: Entry[], today: LocalDate): AppointmentRow[] {
  return entries
    .filter((e) => isAppointment(e.item) && datePart(e.occurrence.start) >= today && e.state?.status !== "SKIPPED")
    .map((e) => ({ ...e, daysLeft: daysBetween(today, datePart(e.occurrence.start)) }));
}

/** One member's readings of one type (CUSTOM per name), oldest first for the chart. */
export function metricSeries(metrics: HealthMetric[], memberId: string, type: HealthMetricType, customName?: string): HealthMetric[] {
  return metrics
    .filter((m) => m.memberId === memberId && m.type === type && (type !== "CUSTOM" || m.customName === customName))
    .sort((a, b) => (a.measuredAt < b.measuredAt ? -1 : a.measuredAt > b.measuredAt ? 1 : 0));
}

/** "6,5" → [6.5]; blood pressure "120/80" → [120, 80]. Anything unreadable becomes NaN for validateMetric to reject. */
export function parseMetricValues(text: string, type: HealthMetricType): number[] {
  const parts = type === "BLOOD_PRESSURE" ? text.split("/") : [text];
  return parts.map((p) => {
    const s = p.trim().replace(",", ".");
    return s === "" || !/^-?\d+(\.\d+)?$/.test(s) ? Number.NaN : Number(s);
  });
}

/** "12/10/2026" */
export function vnDate(d: LocalDate): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** "12/10/2026 08:30", or the date alone for all-day values. */
export function vnDateTime(v: LocalDate | LocalDateTime): string {
  const time = timePart(v);
  return time ? `${vnDate(datePart(v))} ${time}` : vnDate(datePart(v));
}

export function isHealthTab(v: string | null): v is HealthTab {
  return !!v && (HEALTH_TABS as readonly string[]).includes(v);
}
