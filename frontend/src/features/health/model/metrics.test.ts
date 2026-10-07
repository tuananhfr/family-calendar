import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HealthMetric } from "@/core/model/health";
import { makeMember } from "@/core/test-support/items";
import { baseFields } from "@/core/test-support/records";
import { formatMetricValue, latestMetrics, METRIC_RANGES, validateMetric } from "./metrics";

const JUDGEMENT = /(^|[^\p{L}])(cao|thấp|bình thường|tốt|xấu|nguy hiểm|béo|gầy)([^\p{L}]|$)/iu;

describe("validateMetric", () => {
  it("checks only what an instrument can physically show", () => {
    const bad = validateMetric({ type: "BLOOD_PRESSURE", values: [300, 20] });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.message).toMatch(/^Giá trị ngoài khoảng đo được/);
  });

  it("an unusual but measurable value is accepted with no comment", () => {
    expect(validateMetric({ type: "BLOOD_PRESSURE", values: [160, 100] })).toEqual({ ok: true });
    expect(validateMetric({ type: "WEIGHT", values: [6] })).toEqual({ ok: true });
    expect(validateMetric({ type: "TEMPERATURE", values: [39.5] })).toEqual({ ok: true });
    expect(validateMetric({ type: "CUSTOM", values: [12345] })).toEqual({ ok: true });
  });

  it("needs the right number of values and finite numbers", () => {
    expect(validateMetric({ type: "BLOOD_PRESSURE", values: [120] }).ok).toBe(false);
    expect(validateMetric({ type: "WEIGHT", values: [] }).ok).toBe(false);
    expect(validateMetric({ type: "WEIGHT", values: [Number.NaN] }).ok).toBe(false);
    expect(validateMetric({ type: "HEART_RATE", values: [-5] }).ok).toBe(false);
    expect(validateMetric({ type: "BLOOD_PRESSURE", values: [80, 120] }).ok).toBe(false);
  });

  it("no message ever judges a value", () => {
    const samples: Array<[keyof typeof METRIC_RANGES, number[]]> = [];
    for (const [type, ranges] of Object.entries(METRIC_RANGES) as Array<[keyof typeof METRIC_RANGES, Array<{ min: number; max: number }>]>) {
      samples.push([type, ranges.map((r) => r.min - 1)], [type, ranges.map((r) => r.max + 1)], [type, ranges.map((r) => (r.min + r.max) / 2)], [type, []]);
    }
    for (const [type, values] of samples) {
      const r = validateMetric({ type, values });
      if (!r.ok) expect(r.message).not.toMatch(JUDGEMENT);
    }
  });
});

describe("latestMetrics", () => {
  const bo = makeMember("Bố");
  const be = makeMember("Bé An");
  const metric = (memberId: string, type: HealthMetric["type"], value: number, measuredAt: string, extra: Partial<HealthMetric> = {}) =>
    ({ ...baseFields(), memberId, type, value, measuredAt, ...extra }) as HealthMetric;

  it("keeps the newest value per member and type, labelled 'Bố: 6kg' style", () => {
    const list = latestMetrics(
      [
        metric(bo.id, "WEIGHT", 70, "2026-09-01T07:00"),
        metric(bo.id, "WEIGHT", 68.5, "2026-10-01T07:00"),
        metric(bo.id, "BLOOD_PRESSURE", 120, "2026-10-02T07:00", { value2: 80 }),
        metric(be.id, "WEIGHT", 6, "2026-10-03T07:00"),
        metric(be.id, "TEMPERATURE", 37.2, "2026-10-03T08:00"),
        metric(be.id, "SLEEP", 9.5, "2026-10-03T06:00"),
        { ...metric(be.id, "HEIGHT", 60, "2026-10-04T06:00"), deletedAt: "2026-10-05T00:00:00.000Z" },
      ],
      [bo, be],
    );
    expect(list.map((m) => [m.type, m.display])).toEqual([
      ["WEIGHT", "Bố: 68,5kg"],
      ["BLOOD_PRESSURE", "Bố: 120/80 mmHg"],
      ["WEIGHT", "Bé An: 6kg"],
      ["SLEEP", "Bé An: 9,5 giờ"],
      ["TEMPERATURE", "Bé An: 37,2°C"],
    ]);
    expect(list[0]).toMatchObject({ memberId: bo.id, measuredAt: "2026-10-01T07:00" });
  });

  it("members not asked for are left out", () => {
    expect(latestMetrics([metric(be.id, "WEIGHT", 6, "2026-10-03T07:00")], [bo])).toEqual([]);
  });

  it("custom metrics are told apart by name and carry their unit", () => {
    const list = latestMetrics(
      [
        metric(bo.id, "CUSTOM", 5.6, "2026-10-01T07:00", { customName: "HbA1c", unit: "%" }),
        metric(bo.id, "CUSTOM", 30, "2026-10-01T07:00", { customName: "Bước chân", unit: "nghìn bước" }),
      ],
      [bo],
    );
    expect(list.map((m) => m.display).sort()).toEqual(["Bố: Bước chân 30 nghìn bước", "Bố: HbA1c 5,6 %"]);
  });

  it("formats values with a Vietnamese decimal comma", () => {
    expect(formatMetricValue({ type: "BLOOD_GLUCOSE", value: 5.4 })).toBe("5,4 mmol/L");
    expect(formatMetricValue({ type: "HEART_RATE", value: 72 })).toBe("72 bpm");
    expect(formatMetricValue({ type: "HEIGHT", value: 172 })).toBe("172cm");
  });
});

describe("health modules", () => {
  it("contain no judgement words anywhere in their source (modules.md §8)", () => {
    for (const file of ["./metrics.ts", "./medication-status.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(JUDGEMENT);
    }
  });
});
