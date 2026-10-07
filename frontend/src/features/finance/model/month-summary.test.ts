import { describe, expect, it } from "vitest";
import type { FinanceGoal, FinanceSaving, FinanceTxn } from "@/core/model/finance";
import { baseFields } from "@/core/test-support/records";
import { monthSummary } from "./month-summary";

function txn(type: FinanceTxn["type"], amount: number, category: FinanceTxn["category"], date: string): FinanceTxn {
  return { ...baseFields(), type, amount, category, date } as FinanceTxn;
}

const goal = (contributions: FinanceGoal["contributions"]): FinanceGoal =>
  ({ ...baseFields(), name: "Du lịch hè", targetAmount: 30_000_000, contributions }) as FinanceGoal;

const saving = (principal: number, startDate: string): FinanceSaving =>
  ({ ...baseFields(), name: "Sổ VCB", principal, ratePercent: 5.5, startDate, termMonths: 6 }) as FinanceSaving;

// IMG-F: Tổng thu 25.000.000, Tổng chi 18.500.000, Tiết kiệm 6.500.000.
const october = [
  txn("INCOME", 25_000_000, "SALARY", "2026-10-05"),
  txn("EXPENSE", 8_000_000, "FOOD", "2026-10-02"),
  txn("EXPENSE", 5_500_000, "EDUCATION", "2026-10-10"),
  txn("EXPENSE", 3_000_000, "BILLS", "2026-10-15"),
  txn("EXPENSE", 2_000_000, "HEALTH", "2026-10-31"),
];

describe("monthSummary", () => {
  it("Còn lại = thu − chi − tiết kiệm (modules.md §7), IMG-F figures", () => {
    const s = monthSummary(october, [saving(5_000_000, "2026-10-01")], [goal([{ date: "2026-10-20", amount: 1_500_000 }])], "2026-10");
    expect(s.income).toBe(BigInt(25_000_000));
    expect(s.expense).toBe(BigInt(18_500_000));
    expect(s.saved).toBe(BigInt(6_500_000));
    expect(s.remaining).toBe(BigInt(0));
  });

  it("ignores other months and transfers", () => {
    const s = monthSummary(
      [...october, txn("EXPENSE", 999, "FOOD", "2026-09-30"), txn("EXPENSE", 999, "FOOD", "2026-11-01"), { ...txn("TRANSFER", 7_000_000, "TRANSFER", "2026-10-03") }],
      [saving(9_000_000, "2026-09-30")],
      [goal([{ date: "2026-11-01", amount: 1 }])],
      "2026-10",
    );
    expect(s.expense).toBe(BigInt(18_500_000));
    expect(s.income).toBe(BigInt(25_000_000));
    expect(s.saved).toBe(BigInt(0));
  });

  it("splits spending by category, largest first, with percentages", () => {
    const s = monthSummary(october, [], [], "2026-10");
    expect(s.byCategory.map((c) => [c.category, c.amount, c.percent])).toEqual([
      ["FOOD", BigInt(8_000_000), 43.2],
      ["EDUCATION", BigInt(5_500_000), 29.7],
      ["BILLS", BigInt(3_000_000), 16.2],
      ["HEALTH", BigInt(2_000_000), 10.8],
    ]);
  });

  it("compares with the previous month and never divides by zero", () => {
    const s = monthSummary([...october, txn("EXPENSE", 10_000_000, "FOOD", "2026-09-12")], [], [], "2026-10");
    expect(s.deltaVsPrev.expense).toBe(85);
    expect(s.deltaVsPrev.income).toBeNull();

    const jan = monthSummary([txn("INCOME", 1, "SALARY", "2027-01-01"), txn("INCOME", 2, "SALARY", "2026-12-31")], [], [], "2027-01");
    expect(jan.deltaVsPrev.income).toBe(-50);
  });

  it("an empty month is all zeros", () => {
    const s = monthSummary([], [], [], "2026-10");
    expect(s).toMatchObject({ income: BigInt(0), expense: BigInt(0), saved: BigInt(0), remaining: BigInt(0), byCategory: [] });
  });

  it("deleted records do not count", () => {
    const s = monthSummary([{ ...txn("EXPENSE", 5, "FOOD", "2026-10-02"), deletedAt: "2026-10-03T00:00:00.000Z" }], [], [], "2026-10");
    expect(s.expense).toBe(BigInt(0));
  });
});
