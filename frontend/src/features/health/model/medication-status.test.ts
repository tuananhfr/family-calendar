import { describe, expect, it } from "vitest";
import { makeItem, makeState, occurrenceOf } from "@/core/test-support/items";
import { MEDICATION_WINDOWS, medicationStatus } from "./medication-status";

const med = makeItem({
  kind: "REMINDER",
  preset: "MEDICATION",
  category: "HEALTH",
  dataClass: "SENSITIVE",
  title: "Thuốc huyết áp",
  start: "2026-10-06T07:00",
});
const occ = occurrenceOf(med);
const at = (hhmm: string) => `2026-10-06T${hhmm}`;

describe("medicationStatus", () => {
  it("uses the spec windows: 30 minutes before, 60 minutes grace", () => {
    expect(MEDICATION_WINDOWS).toEqual({ soonMinutes: 30, graceMinutes: 60 });
  });

  it("the four boundaries of a 07:00 dose", () => {
    expect(medicationStatus(occ, undefined, at("06:29"), MEDICATION_WINDOWS)).toBe("NOT_YET");
    expect(medicationStatus(occ, undefined, at("06:30"), MEDICATION_WINDOWS)).toBe("DUE_SOON");
    expect(medicationStatus(occ, undefined, at("06:31"), MEDICATION_WINDOWS)).toBe("DUE_SOON");
    expect(medicationStatus(occ, undefined, at("07:45"), MEDICATION_WINDOWS)).toBe("DUE_SOON");
    expect(medicationStatus(occ, undefined, at("08:00"), MEDICATION_WINDOWS)).toBe("DUE_SOON");
    expect(medicationStatus(occ, undefined, at("08:01"), MEDICATION_WINDOWS)).toBe("MISSED");
  });

  it("DONE is taken and SKIPPED is skipped at any time", () => {
    expect(medicationStatus(occ, makeState(med, "2026-10-06T07:00", "DONE"), at("06:00"), MEDICATION_WINDOWS)).toBe("TAKEN");
    expect(medicationStatus(occ, makeState(med, "2026-10-06T07:00", "DONE"), at("23:00"), MEDICATION_WINDOWS)).toBe("TAKEN");
    expect(medicationStatus(occ, makeState(med, "2026-10-06T07:00", "SKIPPED"), at("09:00"), MEDICATION_WINDOWS)).toBe("SKIPPED");
  });

  it("a snoozed dose is still pending, then missed after the grace", () => {
    const snoozed = makeState(med, "2026-10-06T07:00", "SNOOZED", { snoozeUntil: "2026-10-06T00:10:00.000Z" });
    expect(medicationStatus(occ, snoozed, at("07:05"), MEDICATION_WINDOWS)).toBe("DUE_SOON");
    expect(medicationStatus(occ, snoozed, at("08:30"), MEDICATION_WINDOWS)).toBe("MISSED");
  });

  it("a state of another occurrence is ignored", () => {
    expect(medicationStatus(occ, makeState(med, "2026-10-05T07:00", "DONE"), at("08:30"), MEDICATION_WINDOWS)).toBe("MISSED");
  });

  it("works across midnight", () => {
    const late = occurrenceOf(makeItem({ kind: "REMINDER", preset: "MEDICATION", category: "HEALTH", start: "2026-10-07T00:10" }));
    expect(medicationStatus(late, undefined, at("23:45"), MEDICATION_WINDOWS)).toBe("DUE_SOON");
    expect(medicationStatus(late, undefined, at("23:30"), MEDICATION_WINDOWS)).toBe("NOT_YET");
  });

  it("an all-day dose is pending on its day and missed afterwards", () => {
    const daily = occurrenceOf(makeItem({ kind: "REMINDER", preset: "MEDICATION", category: "HEALTH", start: "2026-10-06" }));
    expect(medicationStatus(daily, undefined, "2026-10-05T23:00", MEDICATION_WINDOWS)).toBe("NOT_YET");
    expect(medicationStatus(daily, undefined, at("15:00"), MEDICATION_WINDOWS)).toBe("DUE_SOON");
    expect(medicationStatus(daily, undefined, "2026-10-07T00:00", MEDICATION_WINDOWS)).toBe("MISSED");
  });
});
