import { describe, expect, it } from "vitest";
import type { FinanceTxn } from "@/core/model/finance";
import { groupDigits, isYearMonth, monthTitle, parseMoneyInput, shiftMonth, signedAmount, txnsInMonth } from "./finance-view";

const txn = (date: string, createdAt: string, extra: Partial<FinanceTxn> = {}) => ({ date, createdAt, deletedAt: null, type: "EXPENSE", amount: 1, ...extra }) as FinanceTxn;

describe("finance-view", () => {
  it("steps months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-10", 0)).toBe("2026-10");
    expect(monthTitle("2026-10")).toBe("Tháng 10, 2026");
    expect(isYearMonth("2026-13")).toBe(false);
    expect(isYearMonth("2026-09")).toBe(true);
  });

  it("signs amounts like IMG-F", () => {
    expect(signedAmount({ type: "EXPENSE", amount: 2_000_000 })).toBe("-2.000.000đ");
    expect(signedAmount({ type: "INCOME", amount: 25_000_000 })).toBe("+25.000.000đ");
    expect(signedAmount({ type: "TRANSFER", amount: 500 })).toBe("500đ");
  });

  it("keeps the month's live transactions, newest date first then newest entry", () => {
    const rows = txnsInMonth([txn("2026-10-01", "a"), txn("2026-10-05", "b"), txn("2026-10-05", "c"), txn("2026-09-30", "d"), txn("2026-10-07", "e", { deletedAt: "x" })], "2026-10");
    expect(rows.map((r) => r.createdAt)).toEqual(["c", "b", "a"]);
  });

  it("money input keeps digits only and groups them back", () => {
    expect(parseMoneyInput("2.000.000đ")).toBe(2_000_000);
    expect(parseMoneyInput("00450")).toBe(450);
    expect(parseMoneyInput("abc")).toBeUndefined();
    expect(groupDigits(4_100_000)).toBe("4.100.000");
    expect(groupDigits(undefined)).toBe("");
  });
});
