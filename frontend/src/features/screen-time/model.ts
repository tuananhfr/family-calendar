import { addDays } from "@/core/time/local-date";

export interface ScreenMember {
  id: string;
  display_name: string;
  profile: string;
  can_manage: boolean;
}
export interface AppUsage {
  package_name: string;
  label: string;
  seconds: number;
}
export interface UsageDay {
  date: string;
  total_seconds: number | null;
  coverage: "UNKNOWN" | "PARTIAL" | "COMPLETE";
  updated_at: string | null;
  apps: AppUsage[];
  device_count: number;
}
export interface ScreenSummary {
  member_id: string;
  time_zone: string;
  can_manage: boolean;
  source: string;
  goal: {
    limit_minutes: number;
    reminders_enabled: boolean;
    version: number;
  } | null;
  devices: {
    id: string;
    label: string;
    state: string;
    last_seen_at: string | null;
    consent_at: string | null;
  }[];
  days: UsageDay[];
}

export function screenRange(end: string, period: number) {
  return { from: addDays(end, 1 - period), to: end };
}

export function durationLabel(seconds: number | null): string {
  if (seconds === null) return "Chưa có dữ liệu";
  if (seconds > 0 && seconds < 60) return "Dưới 1 phút";
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ""}`
    : `${minutes} phút`;
}

/** Missing days are excluded, rather than silently counted as zero. */
export function screenStats(days: UsageDay[]) {
  const observed = days.filter((d) => d.total_seconds !== null);
  const total = observed.length
    ? observed.reduce((sum, d) => sum + d.total_seconds!, 0)
    : null;
  return {
    total,
    average: total === null ? null : Math.round(total / observed.length),
    observedDays: observed.length,
    partial: observed.some((d) => d.coverage === "PARTIAL"),
  };
}

export const DEVICE_STATES: Record<string, string> = {
  UNLINKED: "Chờ liên kết",
  PENDING_PERMISSION: "Chờ cấp quyền trên điện thoại",
  ACTIVE: "Đang kết nối",
  PERMISSION_REVOKED: "Đã tắt quyền sử dụng",
  STALE: "Chưa cập nhật gần đây",
  DISCONNECTED: "Đã ngừng chia sẻ",
};
