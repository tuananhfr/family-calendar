import { parseLocalDate } from "@/core/time/local-date";
import { datePart, instantToZoned, timePart } from "@/core/time/zoned";

const pad = (n: number) => String(n).padStart(2, "0");

/** "12/10/2026" in the Space time zone, as the mockup's file tiles show. */
export function fileDate(iso: string, timeZone: string): string {
  const { year, month, day } = parseLocalDate(datePart(instantToZoned(new Date(iso), timeZone)));
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** "12/10/2026 08:30" for the preview details. */
export function fileDateTime(iso: string, timeZone: string): string {
  const local = instantToZoned(new Date(iso), timeZone);
  return `${fileDate(iso, timeZone)} ${timePart(local) ?? ""}`.trim();
}

/** EXIF `takenAt` is already wall time ("2026-10-05T07:15"), never shifted. */
export function takenLabel(takenAt: string): string {
  const { year, month, day } = parseLocalDate(datePart(takenAt));
  return `${pad(day)}/${pad(month)}/${year} ${timePart(takenAt) ?? ""}`.trim();
}
