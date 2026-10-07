import { describe, expect, it } from "vitest";
import type { FinanceBudget, FinanceTxn } from "@/core/model/finance";
import { baseFields } from "@/core/test-support/records";
import { budgetRows, budgetStatus } from "./budget-status";

const budget = { ...baseFields(), month: "2026-10", category: "FOOD", limitAmount: 5_000_000 } as FinanceBudget;

describe("budgetStatus", () => {
  it("warns from 80% and is over from 100%", () => {
    expect(budgetStatus(budget, BigInt(0))).toBe("OK");
    expect(budgetStatus(budget, BigInt(3_999_999))).toBe("OK");
    expect(budgetStatus(budget, BigInt(4_000_000))).toBe("WARN_80");
    expect(budgetStatus(budget, BigInt(4_100_000))).toBe("WARN_80");
    expect(budgetStatus(budget, BigInt(5_000_000))).toBe("OVER");
    expect(budgetStatus(budget, BigInt(7_000_000))).toBe("OVER");
  });
});

describe("budgetRows", () => {
  it("adds up the month's spending of each budget's category", () => {
    const t = (amount: number, category: FinanceTxn["category"], date: string, type: FinanceTxn["type"] = "EXPENSE") =>
      ({ ...baseFields(), type, amount, category, date }) as FinanceTxn;
    const rows = budgetRows([budget], [t(2_100_000, "FOOD", "2026-10-01"), t(2_000_000, "FOOD", "2026-10-20"), t(9_000_000, "FOOD", "2026-09-30"), t(1_000_000, "BILLS", "2026-10-02")], "2026-10");
    expect(rows).toEqual([{ budget, spent: BigInt(4_100_000), percent: 82, status: "WARN_80" }]);
  });

  it("only budgets of the month are listed", () => {
    expect(budgetRows([budget], [], "2026-11")).toEqual([]);
  });
});
