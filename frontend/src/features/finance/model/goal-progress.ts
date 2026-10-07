import type { FinanceGoal } from "@/core/model/finance";
import { sumMoney, toMoney, type Money } from "./money";

/** Percent is floored so a goal only shows 100% once it is actually reached. */
export function goalProgress(goal: Pick<FinanceGoal, "targetAmount" | "contributions">): { saved: Money; percent: number } {
  const saved = sumMoney(goal.contributions.map((c) => toMoney(c.amount)));
  const percent = Number((saved * BigInt(100)) / toMoney(goal.targetAmount));
  return { saved, percent: Math.min(100, percent) };
}
