import { describe, expect, it } from "vitest";
import type { FinanceLoan } from "@/core/model/finance";
import { baseFields } from "@/core/test-support/records";
import { loanOutstanding, loanPaid } from "./loan-balance";

const loan = (payments: FinanceLoan["payments"]): FinanceLoan =>
  ({ ...baseFields(), direction: "BORROWED", counterparty: "Chú Tư", principal: 50_000_000, startDate: "2026-01-01", payments }) as FinanceLoan;

describe("loan balance", () => {
  it("outstanding = principal − all payments", () => {
    const l = loan([
      { date: "2026-03-01", amount: 10_000_000 },
      { date: "2026-06-01", amount: 15_000_000 },
    ]);
    expect(loanPaid(l)).toBe(BigInt(25_000_000));
    expect(loanOutstanding(l)).toBe(BigInt(25_000_000));
  });

  it("no payments → the whole principal; overpaid → 0", () => {
    expect(loanOutstanding(loan([]))).toBe(BigInt(50_000_000));
    expect(loanOutstanding(loan([{ date: "2026-03-01", amount: 60_000_000 }]))).toBe(BigInt(0));
  });
});
