import type { FinanceBudget, FinanceTxn } from "@/core/model/finance";
import { sumMoney, toMoney, type Money } from "./money";

export type BudgetStatus = "OK" | "WARN_80" | "OVER";

/** modules.md §7: alert at ≥ 80% and at ≥ 100% of the limit. */
export function budgetStatus(budget: Pick<FinanceBudget, "limitAmount">, spent: Money): BudgetStatus {
  const limit = toMoney(budget.limitAmount);
  if (spent >= limit) return "OVER";
  return spent * BigInt(10) >= limit * BigInt(8) ? "WARN_80" : "OK";
}

export interface BudgetRow {
  budget: FinanceBudget;
  spent: Money;
  /** Whole percent of the limit, may exceed 100. */
  percent: number;
  status: BudgetStatus;
}

export function budgetRows(budgets: FinanceBudget[], txns: FinanceTxn[], month: string): BudgetRow[] {
  return budgets
    .filter((b) => b.deletedAt === null && b.month === month)
    .map((budget) => {
      const spent = sumMoney(
        txns
          .filter((t) => t.deletedAt === null && t.type === "EXPENSE" && t.category === budget.category && t.date.slice(0, 7) === month)
          .map((t) => toMoney(t.amount)),
      );
      const percent = Number((spent * BigInt(100)) / toMoney(budget.limitAmount));
      return { budget, spent, percent, status: budgetStatus(budget, spent) };
    });
}
