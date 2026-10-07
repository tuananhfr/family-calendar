import type { Schedule } from "@/core/recurrence/types";
import { dayOfWeek, parseLocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";

const labels = {
  once: "Chỉ một lần",
  daily: "Hằng ngày",
  weekdays: "Hằng ngày (T2–T6)",
  weekly: (day: string) => `${day} hằng tuần`,
  monthly: (day: number) => `Hằng tháng (ngày ${day})`,
  yearly: "Hằng năm",
  lunarYearly: "Hằng năm (âm lịch)",
  lunarMonthly: (day: number) => `Hằng tháng (âm lịch, ngày ${day})`,
  custom: "Tùy chỉnh",
  sunday: "Chủ nhật",
};

const CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
// "Thứ 2" … "Thứ 7" by RRULE code; Sunday has its own name.
const NUMBER: Record<string, number> = { MO: 2, TU: 3, WE: 4, TH: 5, FR: 6, SA: 7 };
/** Bounds don't change how the repetition reads. */
const IGNORED = new Set(["UNTIL", "COUNT", "WKST"]);

function weekdayName(code: string): string {
  return code === "SU" ? labels.sunday : `Thứ ${NUMBER[code]}`;
}

function daysLabel(codes: string[]): string {
  const numbered = ["MO", "TU", "WE", "TH", "FR", "SA"].filter((c) => codes.includes(c)).map((c) => NUMBER[c]);
  const head = numbered.length > 0 ? `Thứ ${numbered.join(",")}` : "";
  if (!codes.includes("SU")) return head;
  return head ? `${head}, ${labels.sunday}` : labels.sunday;
}

/** 'Hằng ngày' | 'Hằng ngày (T2–T6)' | 'Thứ 2,4,6' | 'Hằng năm' | 'Chỉ một lần' | 'Hằng năm (âm lịch)' | … */
export function repeatLabel(s: Pick<Schedule, "start" | "rrule" | "lunarRule">): string {
  if (s.lunarRule) return s.lunarRule.freq === "YEARLY" ? labels.lunarYearly : labels.lunarMonthly(s.lunarRule.day);
  if (!s.rrule) return labels.once;
  const parts = new Map<string, string>();
  for (const p of s.rrule.replace(/^RRULE:/i, "").split(";")) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const key = p.slice(0, eq).toUpperCase();
    if (!IGNORED.has(key)) parts.set(key, p.slice(eq + 1).toUpperCase());
  }
  if ((parts.get("INTERVAL") ?? "1") !== "1") return labels.custom;
  parts.delete("INTERVAL");
  const freq = parts.get("FREQ");
  const keys = [...parts.keys()].sort().join(",");
  const startDate = datePart(s.start);
  if (freq === "DAILY" && keys === "FREQ") return labels.daily;
  if (freq === "WEEKLY" && (keys === "FREQ" || keys === "BYDAY,FREQ")) {
    const codes = (parts.get("BYDAY") ?? CODES[dayOfWeek(startDate)]).split(",");
    if (!codes.every((c) => CODES.includes(c))) return labels.custom;
    if (codes.length === 5 && ["MO", "TU", "WE", "TH", "FR"].every((c) => codes.includes(c))) return labels.weekdays;
    if (codes.length === 1) return labels.weekly(weekdayName(codes[0]));
    return daysLabel(codes);
  }
  if (freq === "MONTHLY" && (keys === "FREQ" || keys === "BYMONTHDAY,FREQ")) {
    const day = Number(parts.get("BYMONTHDAY") ?? parseLocalDate(startDate).day);
    return Number.isInteger(day) && day > 0 ? labels.monthly(day) : labels.custom;
  }
  if (freq === "YEARLY" && ["FREQ", "BYMONTH,BYMONTHDAY,FREQ"].includes(keys)) return labels.yearly;
  return labels.custom;
}
