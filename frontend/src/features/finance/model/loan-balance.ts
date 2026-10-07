import type { FinanceLoan } from "@/core/model/finance";
import { sumMoney, toMoney, type Money } from "./money";

export function loanPaid(loan: Pick<FinanceLoan, "payments">): Money {
  return sumMoney(loan.payments.map((p) => toMoney(p.amount)));
}

/** Dư nợ = principal − all payments, never below 0 (modules.md §7). */
export function loanOutstanding(loan: Pick<FinanceLoan, "principal" | "payments">): Money {
  const left = toMoney(loan.principal) - loanPaid(loan);
  return left > BigInt(0) ? left : BigInt(0);
}
