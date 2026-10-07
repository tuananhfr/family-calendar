import type { z } from "zod";
import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import { newId } from "@/core/ids";
import {
  financeBudgetSchema,
  financeGoalSchema,
  financeLoanSchema,
  financeSavingSchema,
  financeTxnSchema,
  type FinanceBudget,
  type FinanceGoal,
  type FinanceLoan,
  type FinanceSaving,
  type FinanceTxn,
} from "@/core/model/finance";
import { addLocalNotification } from "@/core/notifications/local-center";
import { getActive, listActive } from "@/core/repo/read";
import { deleteResource, RepoError, saveResource } from "@/core/repo/write";
import type { LocalDate } from "@/core/time/local-date";
import { changeCategory, createItemFromForm, newFormValues } from "@/features/items";
import { t } from "@/i18n/vi";
import { budgetRows, type BudgetStatus } from "./budget-status";
import { FINANCE_CATEGORY_LABELS } from "./categories";
import { maturityDate, MATURITY_REMINDER_DAYS } from "./saving-maturity";

type Base = "id" | "spaceId" | "createdByActorId" | "dataClass" | "sharingScope" | "revision" | "createdAt" | "updatedAt" | "deletedAt" | "syncState";
export type TxnDraft = Omit<FinanceTxn, Base>;
export type BudgetDraft = Omit<FinanceBudget, Base>;
export type SavingDraft = Omit<FinanceSaving, Base>;
export type LoanDraft = Omit<FinanceLoan, Base>;
export type GoalDraft = Omit<FinanceGoal, Base>;
export type FinanceType = "finance_txn" | "finance_budget" | "finance_saving" | "finance_loan" | "finance_goal";

/** field → stable error code, same shape as ItemFormError so forms map both the same way. */
export class FinanceFormError extends Error {
  constructor(readonly fields: Record<string, string>) {
    super(
      `FINANCE_FORM_INVALID: ${Object.entries(fields)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
    this.name = "FinanceFormError";
  }
}

const LOAN_REMINDER_DAYS = 3;
const REMINDER_TIME = "09:00";

async function envelope(spaceId: string, id?: string) {
  const space = await db.spaces.get(spaceId);
  if (!space || space.deletedAt !== null) throw new RepoError("SPACE_NOT_FOUND", spaceId);
  const { actorId } = await getLocalIdentity();
  const now = new Date().toISOString();
  return {
    id: id ?? newId(),
    spaceId,
    createdByActorId: actorId,
    // Who sees money is decided by the `finance` capability (a child role has NONE), not per record.
    dataClass: "NORMAL" as const,
    sharingScope: space.kind === "FAMILY" ? ("FAMILY_ALL" as const) : ("GROUP_MEMBERS" as const),
    revision: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncState: "LOCAL" as const,
  };
}

function parse<T>(schema: z.ZodType<T>, record: unknown): T {
  const res = schema.safeParse(record);
  if (res.success) return res.data;
  const fields: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const key = String(issue.path[0] ?? "form");
    fields[key] ??= issue.message;
  }
  throw new FinanceFormError(fields);
}

async function upsert<T extends FinanceTxn | FinanceBudget | FinanceSaving | FinanceLoan | FinanceGoal>(
  type: FinanceType,
  schema: z.ZodType<T>,
  spaceId: string,
  draft: object,
  id?: string,
): Promise<T> {
  const base = await envelope(spaceId, id);
  const existing = id ? await getActive<T>(type, id) : undefined;
  if (id && !existing) throw new RepoError("NOT_FOUND", id);
  // Edits keep the author: ownership drives the OWN_OR_ASSIGNED checks.
  const keep = existing ? { createdByActorId: existing.createdByActorId, createdAt: existing.createdAt } : {};
  const record = parse(schema, { ...base, ...keep, ...draft });
  return saveResource(type, record, existing ? "update" : "create");
}

const STATUS_RANK: Record<BudgetStatus, number> = { OK: 0, WARN_80: 1, OVER: 2 };
type BudgetSnapshot = Map<string, { status: BudgetStatus; percent: number; budget: FinanceBudget }>;

async function budgetSnapshot(spaceId: string): Promise<BudgetSnapshot> {
  const [budgets, txns] = await Promise.all([listActive<FinanceBudget>("finance_budget", spaceId), listActive<FinanceTxn>("finance_txn", spaceId)]);
  const months = [...new Set(budgets.map((b) => b.month))];
  return new Map(months.flatMap((m) => budgetRows(budgets, txns, m)).map((r) => [r.budget.id, { status: r.status, percent: r.percent, budget: r.budget }]));
}

/** In-app alert only when a budget moves up a level (→ ≥80%, → ≥100%); more spending inside a level stays quiet. */
async function alertCrossedBudgets(spaceId: string, before: BudgetSnapshot): Promise<void> {
  const after = await budgetSnapshot(spaceId);
  for (const [id, now] of after) {
    const prev = before.get(id)?.status ?? "OK";
    if (STATUS_RANK[now.status] <= STATUS_RANK[prev]) continue;
    const [year, month] = now.budget.month.split("-");
    const vars = { category: FINANCE_CATEGORY_LABELS[now.budget.category], month: `${Number(month)}/${year}`, percent: now.percent };
    await addLocalNotification({
      spaceId,
      type: "BUDGET_ALERT",
      resourceRef: { type: "finance_budget", id },
      titleSafe: t(now.status === "OVER" ? "finance.alerts.over" : "finance.alerts.warn", vars),
    });
  }
}

async function withBudgetAlerts<T>(spaceId: string, write: () => Promise<T>): Promise<T> {
  const before = await budgetSnapshot(spaceId);
  const out = await write();
  await alertCrossedBudgets(spaceId, before);
  return out;
}

export function saveTxn(spaceId: string, draft: TxnDraft, id?: string): Promise<FinanceTxn> {
  return withBudgetAlerts(spaceId, () => upsert("finance_txn", financeTxnSchema, spaceId, draft, id));
}

export function saveBudget(spaceId: string, draft: BudgetDraft, id?: string): Promise<FinanceBudget> {
  return withBudgetAlerts(spaceId, async () => {
    const others = (await listActive<FinanceBudget>("finance_budget", spaceId)).filter((b) => b.id !== id);
    if (others.some((b) => b.month === draft.month && b.category === draft.category)) throw new FinanceFormError({ category: "BUDGET_DUPLICATE" });
    return upsert("finance_budget", financeBudgetSchema, spaceId, draft, id);
  });
}

async function createFinanceReminder(spaceId: string, opts: { title: string; date: LocalDate; daysBefore: number; memberIds: string[] }): Promise<string> {
  const space = await db.spaces.get(spaceId);
  if (!space) throw new RepoError("SPACE_NOT_FOUND", spaceId);
  const values = changeCategory(newFormValues("REMINDER", { date: opts.date, nowTime: "07:00", spaceKind: space.kind }), "FINANCE", space.kind);
  return createItemFromForm(
    { ...values, title: opts.title.slice(0, 200), startTime: REMINDER_TIME, memberIds: [...opts.memberIds], reminderOffsets: [opts.daysBefore * 24 * 60] },
    { spaceId, timeZone: space.timeZone, spaceKind: space.kind },
  );
}

/**
 * A new deposit gets "Đến hạn sổ tiết kiệm" on its maturity date, firing 7 days ahead (modules.md §7).
 * Edits leave that reminder alone; the user moves it like any other reminder.
 */
export async function saveSaving(spaceId: string, draft: SavingDraft, opts: { memberIds: string[] }, id?: string): Promise<FinanceSaving> {
  const saved = await upsert("finance_saving", financeSavingSchema, spaceId, draft, id);
  if (!id) {
    await createFinanceReminder(spaceId, {
      title: t("finance.reminders.maturity", { name: saved.name }),
      date: maturityDate(saved.startDate, saved.termMonths),
      daysBefore: MATURITY_REMINDER_DAYS,
      memberIds: opts.memberIds,
    });
  }
  return saved;
}

/** A due date on a new loan adds a reminder on that day, firing 3 days ahead. */
export async function saveLoan(spaceId: string, draft: LoanDraft, opts: { memberIds: string[] }, id?: string): Promise<FinanceLoan> {
  const saved = await upsert("finance_loan", financeLoanSchema, spaceId, draft, id);
  if (!id && saved.dueDate) {
    await createFinanceReminder(spaceId, {
      title: t(saved.direction === "BORROWED" ? "finance.reminders.loanDue" : "finance.reminders.lentDue", { name: saved.counterparty }),
      date: saved.dueDate,
      daysBefore: LOAN_REMINDER_DAYS,
      memberIds: opts.memberIds,
    });
  }
  return saved;
}

export function saveGoal(spaceId: string, draft: GoalDraft, id?: string): Promise<FinanceGoal> {
  return upsert("finance_goal", financeGoalSchema, spaceId, draft, id);
}

export async function addLoanPayment(loanId: string, payment: { date: LocalDate; amount: number }): Promise<FinanceLoan> {
  const loan = await getActive<FinanceLoan>("finance_loan", loanId);
  if (!loan) throw new RepoError("NOT_FOUND", loanId);
  return upsert("finance_loan", financeLoanSchema, loan.spaceId, { ...loan, payments: [...loan.payments, payment] }, loan.id);
}

export async function addGoalContribution(goalId: string, contribution: { date: LocalDate; amount: number }): Promise<FinanceGoal> {
  const goal = await getActive<FinanceGoal>("finance_goal", goalId);
  if (!goal) throw new RepoError("NOT_FOUND", goalId);
  return upsert("finance_goal", financeGoalSchema, goal.spaceId, { ...goal, contributions: [...goal.contributions, contribution] }, goal.id);
}

export function deleteFinanceRecord(type: FinanceType, id: string): Promise<void> {
  return deleteResource(type, id);
}

/** "Có" on "Ghi khoản chi này?": one expense linked to the payment reminder; nothing is recorded without asking. */
export function recordPaymentExpense(spaceId: string, prompt: { itemId: string; title: string; amount: number }, date: LocalDate): Promise<FinanceTxn> {
  return saveTxn(spaceId, { type: "EXPENSE", amount: prompt.amount, category: "BILLS", date, note: prompt.title.slice(0, 500), itemId: prompt.itemId });
}
