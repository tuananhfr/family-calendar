import { HEALTH_METRIC_TYPES, HEALTH_METRIC_UNITS, type HealthMetric, type HealthMetricType } from "@/core/model/health";
import type { Member } from "@/core/model/member";

type MeasuredType = Exclude<HealthMetricType, "CUSTOM">;

/**
 * What a home instrument can physically display, per value (blood pressure: systolic, diastolic). These are
 * input-error bounds only; values inside them are never commented on (modules.md §8: no judgement).
 */
export const METRIC_RANGES: Record<MeasuredType, Array<{ min: number; max: number }>> = {
  WEIGHT: [{ min: 0.3, max: 400 }],
  HEIGHT: [{ min: 20, max: 260 }],
  BLOOD_PRESSURE: [
    { min: 40, max: 280 },
    { min: 20, max: 200 },
  ],
  HEART_RATE: [{ min: 20, max: 300 }],
  SLEEP: [{ min: 0, max: 24 }],
  BLOOD_GLUCOSE: [{ min: 0.5, max: 60 }],
  TEMPERATURE: [{ min: 30, max: 45 }],
};

const messages = {
  outOfRange: (min: number, max: number, unit: string) => `Giá trị ngoài khoảng đo được (${formatNumber(min)}–${formatNumber(max)} ${unit}).`,
  count: (n: number) => (n === 2 ? "Cần nhập đủ 2 số (tâm thu / tâm trương)." : "Cần nhập 1 số."),
  notNumber: "Giá trị phải là số.",
  order: "Số tâm thu phải lớn hơn số tâm trương.",
};

export type MetricValidation = { ok: true } | { ok: false; message: string };

export function validateMetric(m: { type: HealthMetricType; values: number[] }): MetricValidation {
  const ranges = m.type === "CUSTOM" ? [{ min: -Infinity, max: Infinity }] : METRIC_RANGES[m.type];
  if (m.values.length !== ranges.length) return { ok: false, message: messages.count(ranges.length) };
  if (!m.values.every(Number.isFinite)) return { ok: false, message: messages.notNumber };
  const unit = m.type === "CUSTOM" ? "" : HEALTH_METRIC_UNITS[m.type];
  for (let i = 0; i < ranges.length; i++) {
    const { min, max } = ranges[i];
    if (m.values[i] < min || m.values[i] > max) return { ok: false, message: messages.outOfRange(min, max, unit) };
  }
  if (m.type === "BLOOD_PRESSURE" && m.values[0] <= m.values[1]) return { ok: false, message: messages.order };
  return { ok: true };
}

function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

// Units written straight after the number in IMG-F ('6kg', '37,2°C'); the rest take a space.
const ATTACHED_UNITS = new Set(["kg", "cm", "°C"]);

export function formatMetricValue(m: Pick<HealthMetric, "type" | "value" | "value2" | "unit" | "customName">): string {
  const unit = m.type === "CUSTOM" ? (m.unit ?? "") : HEALTH_METRIC_UNITS[m.type];
  const value = m.type === "BLOOD_PRESSURE" ? `${formatNumber(m.value)}/${formatNumber(m.value2 ?? 0)}` : formatNumber(m.value);
  const withUnit = ATTACHED_UNITS.has(unit) ? `${value}${unit}` : `${value} ${unit}`.trim();
  return m.type === "CUSTOM" && m.customName ? `${m.customName} ${withUnit}` : withUnit;
}

export interface LatestMetric {
  type: HealthMetricType;
  memberId: string;
  customName?: string;
  measuredAt: string;
  /** 'Bố: 6kg' */
  display: string;
}

/**
 * Newest value per member and type (CUSTOM per name), in the order of `members` then of the metric types.
 * Takes members, not ids: the label needs their display names.
 */
export function latestMetrics(metrics: HealthMetric[], members: Array<Pick<Member, "id" | "displayName">>): LatestMetric[] {
  const latest = new Map<string, HealthMetric>();
  for (const m of metrics) {
    if (m.deletedAt !== null) continue;
    const key = `${m.memberId}|${m.type}|${m.customName ?? ""}`;
    const prev = latest.get(key);
    if (!prev || prev.measuredAt < m.measuredAt) latest.set(key, m);
  }
  const out: LatestMetric[] = [];
  for (const member of members) {
    const own = [...latest.values()].filter((m) => m.memberId === member.id);
    own.sort((a, b) => HEALTH_METRIC_TYPES.indexOf(a.type) - HEALTH_METRIC_TYPES.indexOf(b.type) || (a.customName ?? "").localeCompare(b.customName ?? ""));
    for (const m of own) {
      out.push({
        type: m.type,
        memberId: m.memberId,
        ...(m.customName ? { customName: m.customName } : {}),
        measuredAt: m.measuredAt,
        display: `${member.displayName}: ${formatMetricValue(m)}`,
      });
    }
  }
  return out;
}
