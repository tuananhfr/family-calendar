import { formatLunar, solarToLunar } from "@/core/lunar/lunar";
import type { LocalDate } from "@/core/time/local-date";
import { instantToZoned, timeZoneOffsetMinutes } from "@/core/time/zoned";

export type Greeting = "Chào buổi sáng!" | "Chào buổi trưa!" | "Chào buổi chiều!" | "Chào buổi tối!";

const labels = {
  morning: "Chào buổi sáng!",
  noon: "Chào buổi trưa!",
  afternoon: "Chào buổi chiều!",
  evening: "Chào buổi tối!",
  zoneNote: (place: string, offset: string) => `Giờ theo ${place} (GMT${offset})`,
  vietnam: "Việt Nam",
} as const;

/** 04:00–10:59 sáng, 11:00–12:59 trưa, 13:00–17:59 chiều, otherwise tối. Accepts 'HH:mm' or a LocalDateTime. */
export function greetingFor(localTime: string): Greeting {
  const hhmm = localTime.length > 5 ? localTime.slice(11, 16) : localTime;
  const minutes = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  if (minutes >= 4 * 60 && minutes < 11 * 60) return labels.morning;
  if (minutes >= 11 * 60 && minutes < 13 * 60) return labels.noon;
  if (minutes >= 13 * 60 && minutes < 18 * 60) return labels.afternoon;
  return labels.evening;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

function placeOf(timeZone: string): string {
  if (timeZone === "Asia/Ho_Chi_Minh" || timeZone === "Asia/Saigon") return labels.vietnam;
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

/**
 * Shown next to times when the device clock runs in another offset than the Space (relatives abroad), so
 * "08:00" is never misread as local time. `deviceOffsetMinutes` defaults to this machine's offset at `now`.
 */
export function timeZoneNote(spaceTimeZone: string, now: Date = new Date(), deviceOffsetMinutes: number = -now.getTimezoneOffset()): string | null {
  const spaceOffset = timeZoneOffsetMinutes(now, spaceTimeZone);
  if (spaceOffset === deviceOffsetMinutes) return null;
  return labels.zoneNote(placeOf(spaceTimeZone), formatOffset(spaceOffset));
}

export interface TodayHeader {
  today: LocalDate;
  time: string;
  greeting: Greeting;
  lunarLabel: string;
  timeZoneNote: string | null;
}

/** Everything the Today header needs, computed in the Space time zone rather than the device's. */
export function todayHeader(spaceTimeZone: string, now: Date = new Date()): TodayHeader {
  const local = instantToZoned(now, spaceTimeZone);
  const today = local.slice(0, 10);
  return {
    today,
    time: local.slice(11, 16),
    greeting: greetingFor(local),
    lunarLabel: formatLunar(solarToLunar(today)),
    timeZoneNote: timeZoneNote(spaceTimeZone, now),
  };
}
