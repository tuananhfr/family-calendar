import { describe, expect, it } from "vitest";
import { ageLabel } from "./age";

describe("ageLabel", () => {
  it("counts whole years", () => {
    expect(ageLabel("2016-06-15", "2026-10-06")).toBe("10 tuổi");
  });

  it("subtracts one before this year's birthday", () => {
    expect(ageLabel("2016-12-01", "2026-10-06")).toBe("9 tuổi");
  });

  it("returns null without a birth date or for a future one", () => {
    expect(ageLabel(null, "2026-10-06")).toBeNull();
    expect(ageLabel("2027-01-01", "2026-10-06")).toBeNull();
  });

  it("labels babies under one year in months", () => {
    expect(ageLabel("2026-03-20", "2026-10-06")).toBe("6 tháng tuổi");
  });
});
