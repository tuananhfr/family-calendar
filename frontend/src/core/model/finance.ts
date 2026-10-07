import { z } from "zod";
import { addMonthsClamped } from "../time/month-offset";
import type { LocalDate } from "../time/local-date";
import { baseRecordShape, idSchema, localDateSchema, moneySchema, optionalText, requiredText, yearMonthSchema } from "./base";

// No financial advice anywhere (modules.md §7); these are plain household records in integer VND.

const positiveMoney = moneySchema.refine((v) => v > 0, { error: "AMOUNT_NOT_POSITIVE" });

export const FINANCE_ACCOUNT_TYPES = ["CASH", "BANK", "EWALLET", "OTHER"] as const;
export const FINANCE_TXN_TYPES = ["INCOME", "EXPENSE", "TRANSFER"] as const;
export type FinanceTxnType = (typeof FINANCE_TXN_TYPES)[number];

/** Ăn uống, Học tập, Sinh hoạt, Sức khỏe, Giải trí, Di chuyển, Nhà cửa, Hóa đơn, Mua sắm, Khác. */
export const EXPENSE_CATEGORIES = [
  "FOOD",
  "EDUCATION",
  "LIVING",
  "HEALTH",
  "ENTERTAINMENT",
  "TRANSPORT",
  "HOUSING",
  "BILLS",
  "SHOPPING",
  "OTHER",
] as const;
/** Lương, Thưởng, Kinh doanh, Khác. */
export const INCOME_CATEGORIES = ["SALARY", "BONUS", "BUSINESS", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export const FINANCE_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  "SALARY",
  "BONUS",
  "BUSINESS",
  "TRANSFER",
] as const satisfies readonly (ExpenseCategory | IncomeCategory | "TRANSFER")[];
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

export function categoriesForTxnType(type: FinanceTxnType): readonly FinanceCategory[] {
  if (type === "INCOME") return INCOME_CATEGORIES;
  if (type === "EXPENSE") return EXPENSE_CATEGORIES;
  return ["TRANSFER"];
}

export const financeAccountSchema = z.object({
  ...baseRecordShape,
  name: requiredText(100, "NAME"),
  type: z.enum(FINANCE_ACCOUNT_TYPES),
  openingBalance: moneySchema,
});
export type FinanceAccount = z.infer<typeof financeAccountSchema>;

export const financeTxnSchema = z
  .object({
    ...baseRecordShape,
    type: z.enum(FINANCE_TXN_TYPES),
    amount: positiveMoney,
    category: z.enum(FINANCE_CATEGORIES),
    date: localDateSchema,
    memberId: idSchema.optional(),
    accountId: idSchema.optional(),
    /** TRANSFER destination. */
    toAccountId: idSchema.optional(),
    note: optionalText(500, "NOTE"),
    /** PAYMENT reminder this expense was recorded from. */
    itemId: idSchema.optional(),
    attachmentFileId: idSchema.optional(),
  })
  .superRefine((t, ctx) => {
    if (!categoriesForTxnType(t.type).includes(t.category)) {
      ctx.addIssue({ code: "custom", message: "CATEGORY_NOT_IN_TYPE", path: ["category"] });
    }
    if (t.type === "TRANSFER" && (!t.accountId || !t.toAccountId || t.accountId === t.toAccountId)) {
      ctx.addIssue({ code: "custom", message: "TRANSFER_ACCOUNTS_INVALID", path: ["toAccountId"] });
    }
  });
export type FinanceTxn = z.infer<typeof financeTxnSchema>;

export const financeBudgetSchema = z.object({
  ...baseRecordShape,
  month: yearMonthSchema,
  category: z.enum(EXPENSE_CATEGORIES),
  limitAmount: positiveMoney,
});
export type FinanceBudget = z.infer<typeof financeBudgetSchema>;

function hasAtMostTwoDecimals(v: number): boolean {
  return Math.abs(Math.round(v * 100) - v * 100) < 1e-7;
}

export const financeSavingSchema = z.object({
  ...baseRecordShape,
  name: requiredText(100, "NAME"),
  bank: optionalText(100, "BANK"),
  principal: positiveMoney,
  /** DECIMAL(5,2) on the server. */
  ratePercent: z
    .number()
    .min(0, { error: "RATE_INVALID" })
    .max(100, { error: "RATE_INVALID" })
    .refine(hasAtMostTwoDecimals, { error: "RATE_INVALID" }),
  startDate: localDateSchema,
  termMonths: z.int().min(1, { error: "TERM_INVALID" }).max(600, { error: "TERM_INVALID" }),
});
export type FinanceSaving = z.infer<typeof financeSavingSchema>;

/** Maturity uses calendar months, clamped to month end (31/01 + 1 month → 28/02). */
export function savingMaturityDate(startDate: LocalDate, termMonths: number): LocalDate {
  return addMonthsClamped(startDate, termMonths);
}

const datedAmountSchema = z.object({ date: localDateSchema, amount: positiveMoney });

export const financeLoanSchema = z
  .object({
    ...baseRecordShape,
    direction: z.enum(["BORROWED", "LENT"]),
    counterparty: requiredText(100, "COUNTERPARTY"),
    principal: positiveMoney,
    startDate: localDateSchema,
    dueDate: localDateSchema.optional(),
    note: optionalText(500, "NOTE"),
    payments: z.array(datedAmountSchema).max(500),
  })
  .refine((l) => !l.dueDate || l.dueDate >= l.startDate, { error: "DUE_BEFORE_START", path: ["dueDate"] });
export type FinanceLoan = z.infer<typeof financeLoanSchema>;

export function loanOutstanding(loan: Pick<FinanceLoan, "principal" | "payments">): number {
  return Math.max(0, loan.principal - loan.payments.reduce((sum, p) => sum + p.amount, 0));
}

export const financeGoalSchema = z.object({
  ...baseRecordShape,
  name: requiredText(100, "NAME"),
  targetAmount: positiveMoney,
  deadline: localDateSchema.optional(),
  contributions: z.array(datedAmountSchema).max(1000),
});
export type FinanceGoal = z.infer<typeof financeGoalSchema>;

/** 0..1 share of the target already saved. */
export function goalProgress(goal: Pick<FinanceGoal, "targetAmount" | "contributions">): number {
  const saved = goal.contributions.reduce((sum, c) => sum + c.amount, 0);
  return Math.min(1, saved / goal.targetAmount);
}
