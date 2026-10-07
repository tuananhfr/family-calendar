import { describe, expect, it } from "vitest";
import type { FinanceSaving } from "@/core/model/finance";
import { baseFields } from "@/core/test-support/records";
import { MATURITY_REMINDER_DAYS, maturityDate, maturityReminderDate, savingStatus } from "./saving-maturity";

const saving = { ...baseFields(), name: "Sổ VCB", principal: 100_000_000, ratePercent: 5.5, startDate: "2026-08-31", termMonths: 6 } as FinanceSaving;

describe("maturityDate", () => {
  it("31/08 + 6 months is 28/02 (clamped to month end)", () => {
    expect(maturityDate("2026-08-31", 6)).toBe("2027-02-28");
    expect(maturityDate("2027-08-31", 6)).toBe("2028-02-29");
    expect(maturityDate("2026-01-15", 12)).toBe("2027-01-15");
  });

  it("the reminder is 7 days before maturity", () => {
    expect(MATURITY_REMINDER_DAYS).toBe(7);
    expect(maturityReminderDate(saving)).toBe("2027-02-21");
  });

  it("status and days left are counted on calendar days", () => {
    expect(savingStatus(saving, "2027-02-01")).toEqual({ maturity: "2027-02-28", daysLeft: 27, matured: false });
    expect(savingStatus(saving, "2027-02-28")).toEqual({ maturity: "2027-02-28", daysLeft: 0, matured: true });
    expect(savingStatus(saving, "2027-03-02")).toEqual({ maturity: "2027-02-28", daysLeft: -2, matured: true });
  });
});
