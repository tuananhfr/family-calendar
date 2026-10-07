import type { FinanceCategory, FinanceTxn } from "@/core/model/finance";
import { formatVnd, toMoney } from "./money";

export const FINANCE_TABS = ["overview", "txns", "budgets", "savings", "loans", "goals", "report"] as const;
export type FinanceTab = (typeof FINANCE_TABS)[number];

// Donut/legend colours reuse the category tokens so they flip with the theme; the order follows IMG-F's legend.
const CATEGORY_TONE: Record<FinanceCategory, string> = {
  FOOD: "study",
  EDUCATION: "activity",
  LIVING: "shopping",
  HEALTH: "health",
  ENTERTAINMENT: "housework",
  TRANSPORT: "sport",
  HOUSING: "special",
  BILLS: "document",
  SHOPPING: "family",
  OTHER: "other",
  SALARY: "activity",
  BONUS: "activity",
  BUSINESS: "activity",
  TRANSFER: "other",
};

export const categoryTone = (c: FinanceCategory) => CATEGORY_TONE[c];
export const categoryColor = (c: FinanceCategory) => `var(--cat-${CATEGORY_TONE[c]}-dot)`;

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** "Tháng 10, 2026" as in the IMG-F stepper. */
export function monthTitle(month: string): string {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}, ${y}`;
}

/** '2026-10-05' → '05/10/2026'. */
export const vnDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function isYearMonth(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** Newest first: by date, then by when it was entered (two bills on the same day keep their entry order). */
export function sortTxnsNewest(txns: FinanceTxn[]): FinanceTxn[] {
  return [...txns].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1));
}

export function txnsInMonth(txns: FinanceTxn[], month: string): FinanceTxn[] {
  return sortTxnsNewest(txns.filter((t) => t.deletedAt === null && t.date.slice(0, 7) === month));
}

/** "-2.000.000đ" for money out, "+25.000.000đ" for money in, plain for transfers. */
export function signedAmount(txn: Pick<FinanceTxn, "type" | "amount">): string {
  const v = toMoney(txn.amount);
  if (txn.type === "EXPENSE") return formatVnd(-v);
  if (txn.type === "INCOME") return `+${formatVnd(v)}`;
  return formatVnd(v);
}

/** Digits typed into a money field → integer VND; "" → undefined. Grouping dots and "đ" are ignored. */
export function parseMoneyInput(raw: string): number | undefined {
  const digits = raw
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 15);
  return digits ? Number(digits) : undefined;
}

export function groupDigits(v: number | undefined): string {
  return v === undefined ? "" : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
