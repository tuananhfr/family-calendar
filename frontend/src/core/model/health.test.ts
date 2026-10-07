import { describe, expect, it } from "vitest";
import { newId } from "../ids";
import { healthMetricSchema, healthNoteSchema, healthProfileSchema } from "./health";
import { baseFields, issueCodes } from "../test-support/records";

const base = () => baseFields({ dataClass: "SENSITIVE", sharingScope: "PRIVATE" });

describe("health schemas", () => {
  it("accepts a profile with free-text allergies and conditions", () => {
    const p = { ...base(), memberId: newId(), sex: "FEMALE", bloodType: "O+", allergies: ["Tôm"], conditions: [] };
    expect(healthProfileSchema.safeParse(p).success).toBe(true);
    expect(issueCodes(healthProfileSchema.safeParse({ ...p, bloodType: "Z" }))).toContain("INVALID_BLOOD_TYPE");
  });

  it("requires diastolic for blood pressure and a unit for custom metrics", () => {
    const m = { ...base(), memberId: newId(), type: "BLOOD_PRESSURE", value: 120, measuredAt: "2026-10-06T07:30" };
    expect(issueCodes(healthMetricSchema.safeParse(m))).toContain("SECOND_VALUE_REQUIRED");
    expect(healthMetricSchema.safeParse({ ...m, value2: 80 }).success).toBe(true);
    const c = { ...base(), memberId: newId(), type: "CUSTOM", value: 3, measuredAt: "2026-10-06T07:30" };
    expect(issueCodes(healthMetricSchema.safeParse(c))).toContain("UNIT_REQUIRED");
    expect(healthMetricSchema.safeParse({ ...c, unit: "lần", customName: "Đi bộ" }).success).toBe(true);
  });

  it("requires a non-empty note title", () => {
    const n = { ...base(), memberId: newId(), date: "2026-10-06", title: " ", body: "" };
    expect(issueCodes(healthNoteSchema.safeParse(n))).toContain("TITLE_REQUIRED");
  });
});
