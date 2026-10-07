import { describe, expect, it } from "vitest";
import {
  financeBudgetSchema,
  financeGoalSchema,
  financeLoanSchema,
  financeSavingSchema,
  financeTxnSchema,
  loanOutstanding,
  savingMaturityDate,
} from "./finance";
import { baseFields, issueCodes } from "../test-support/records";

const base = () => baseFields({ dataClass: "PRIVATE", sharingScope: "PRIVATE" });

describe("finance schemas", () => {
  it("accepts an expense and rejects negative / fractional / wrong-category amounts", () => {
    const txn = { ...base(), type: "EXPENSE", amount: 250_000, category: "FOOD", date: "2026-10-06" };
    expect(financeTxnSchema.safeParse(txn).success).toBe(true);
    expect(issueCodes(financeTxnSchema.safeParse({ ...txn, amount: -5 }))).toContain("AMOUNT_NEGATIVE");
    expect(issueCodes(financeTxnSchema.safeParse({ ...txn, amount: 1.5 }))).toContain("AMOUNT_NOT_INTEGER");
    expect(issueCodes(financeTxnSchema.safeParse({ ...txn, category: "SALARY" }))).toContain("CATEGORY_NOT_IN_TYPE");
    expect(financeTxnSchema.safeParse({ ...txn, type: "INCOME", category: "SALARY" }).success).toBe(true);
  });

  it("validates budget month format", () => {
    const b = { ...base(), month: "2026-10", category: "FOOD", limitAmount: 5_000_000 };
    expect(financeBudgetSchema.safeParse(b).success).toBe(true);
    expect(issueCodes(financeBudgetSchema.safeParse({ ...b, month: "2026-13" }))).toContain("INVALID_MONTH");
  });

  it("computes saving maturity with calendar months and validates the rate", () => {
    expect(savingMaturityDate("2026-01-31", 1)).toBe("2026-02-28");
    const s = { ...base(), name: "Sổ 6 tháng", principal: 100_000_000, ratePercent: 5.5, startDate: "2026-04-30", termMonths: 6 };
    expect(financeSavingSchema.safeParse(s).success).toBe(true);
    expect(issueCodes(financeSavingSchema.safeParse({ ...s, ratePercent: 5.555 }))).toContain("RATE_INVALID");
  });

  it("computes loan outstanding and goal progress inputs", () => {
    const loan = {
      ...base(),
      direction: "LENT",
      counterparty: "Cô Ba",
      principal: 10_000_000,
      startDate: "2026-01-01",
      payments: [
        { date: "2026-02-01", amount: 3_000_000 },
        { date: "2026-03-01", amount: 2_000_000 },
      ],
    };
    const parsed = financeLoanSchema.parse(loan);
    expect(loanOutstanding(parsed)).toBe(5_000_000);
    expect(issueCodes(financeLoanSchema.safeParse({ ...loan, dueDate: "2025-12-31" }))).toContain("DUE_BEFORE_START");
    const goal = { ...base(), name: "Du lịch Đà Lạt", targetAmount: 20_000_000, contributions: [] };
    expect(financeGoalSchema.safeParse(goal).success).toBe(true);
    expect(issueCodes(financeGoalSchema.safeParse({ ...goal, targetAmount: 0 }))).toContain("AMOUNT_NOT_POSITIVE");
  });
});
