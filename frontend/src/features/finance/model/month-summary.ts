import type { FinanceCategory, FinanceGoal, FinanceSaving, FinanceTxn } from "@/core/model/finance";
import { percentChange, percentOf, sumMoney, toMoney, type Money } from "./money";

export interface CategoryShare {
  category: FinanceCategory;
  amount: Money;
  percent: number;
}

export interface MonthSummary {
  month: string;
  income: Money;
  expense: Money;
  saved: Money;
  remaining: Money;
  /** Expenses only, largest first. */
  byCategory: CategoryShare[];
  /** Percent vs the previous month; null when that month was 0. */
  deltaVsPrev: { income: number | null; expense: number | null; saved: number | null; remaining: number | null };
}

const inMonth = (date: string, month: string) => date.slice(0, 7) === month;

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function totals(txns: FinanceTxn[], savings: FinanceSaving[], goals: FinanceGoal[], month: string) {
  const live = txns.filter((t) => t.deletedAt === null && inMonth(t.date, month));
  const sumOf = (type: FinanceTxn["type"]) => sumMoney(live.filter((t) => t.type === type).map((t) => toMoney(t.amount)));
  const income = sumOf("INCOME");
  const expense = sumOf("EXPENSE");
  // modules.md §7: Tiết kiệm = goal contributions + new deposits opened in the month.
  const saved = sumMoney([
    ...goals.filter((g) => g.deletedAt === null).flatMap((g) => g.contributions.filter((c) => inMonth(c.date, month)).map((c) => toMoney(c.amount))),
    ...savings.filter((s) => s.deletedAt === null && inMonth(s.startDate, month)).map((s) => toMoney(s.principal)),
  ]);
  return { live, income, expense, saved, remaining: income - expense - saved };
}

/** Month overview of IMG-F. TRANSFER moves money between accounts and is neither income nor expense. */
export function monthSummary(txns: FinanceTxn[], savings: FinanceSaving[], goals: FinanceGoal[], month: string): MonthSummary {
  const cur = totals(txns, savings, goals, month);
  const prev = totals(txns, savings, goals, previousMonth(month));

  const byCat = new Map<FinanceCategory, Money>();
  for (const t of cur.live) if (t.type === "EXPENSE") byCat.set(t.category, (byCat.get(t.category) ?? BigInt(0)) + toMoney(t.amount));
  const byCategory = [...byCat.entries()]
    .map(([category, amount]) => ({ category, amount, percent: percentOf(amount, cur.expense) }))
    .sort((a, b) => (a.amount === b.amount ? a.category.localeCompare(b.category) : a.amount > b.amount ? -1 : 1));

  return {
    month,
    income: cur.income,
    expense: cur.expense,
    saved: cur.saved,
    remaining: cur.remaining,
    byCategory,
    deltaVsPrev: {
      income: percentChange(cur.income, prev.income),
      expense: percentChange(cur.expense, prev.expense),
      saved: percentChange(cur.saved, prev.saved),
      remaining: percentChange(cur.remaining, prev.remaining),
    },
  };
}
