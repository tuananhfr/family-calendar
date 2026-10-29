import { canRead, canReadItem, type AccessContext } from "@/core/access/evaluate";
import type { FinanceGoal, FinanceSaving } from "@/core/model/finance";
import type { HealthMetric } from "@/core/model/health";
import type { LocalDataView } from "@/core/repo/data-view";
import type { DateWindow } from "@/core/recurrence/types";
import { expandOccurrences } from "@/core/recurrence/expand";
import { toMoney } from "@/features/finance/model/money";

export function periodDetails(data: LocalDataView, window: DateWindow, access: AccessContext, extra: { savings: FinanceSaving[]; goals: FinanceGoal[]; metrics: HealthMetric[] }) {
  const inRange = (date: string) => date.slice(0, 10) >= window.from && date.slice(0, 10) <= window.to;
  const transactions = data.financeTxns.filter((row) => !row.deletedAt && inRange(row.date) && canRead(access, row, "finance"));
  const sum = (values: number[]) => values.reduce((total, value) => total + toMoney(value), BigInt(0));
  const income = sum(transactions.filter((row) => row.type === "INCOME").map((row) => row.amount));
  const expense = sum(transactions.filter((row) => row.type === "EXPENSE").map((row) => row.amount));
  const saved = sum([
    ...extra.savings.filter((row) => !row.deletedAt && inRange(row.startDate) && canRead(access, row, "finance")).map((row) => row.principal),
    ...extra.goals.filter((row) => !row.deletedAt && canRead(access, row, "finance")).flatMap((row) => row.contributions.filter((contribution) => inRange(contribution.date)).map((contribution) => contribution.amount)),
  ]);
  const metrics = extra.metrics.filter((row) => !row.deletedAt && inRange(row.measuredAt) && canRead(access, row, "health")).length;
  const notes = data.healthNotes.filter((row) => !row.deletedAt && inRange(row.date) && canRead(access, row, "health")).length;
  const done = new Set(data.states.filter((row) => !row.deletedAt && row.status === "DONE").map((row) => row.occurrenceKey));
  let medicationTotal = 0, medicationDone = 0;
  for (const item of data.items.filter((row) => !row.deletedAt && row.preset === "MEDICATION" && canReadItem(access, row))) {
    const occurrences = expandOccurrences(item.id, item.schedule, window, data.exceptions.filter((row) => !row.deletedAt && row.itemId === item.id));
    medicationTotal += occurrences.length;
    medicationDone += occurrences.filter((occurrence) => done.has(occurrence.occurrenceKey)).length;
  }
  return { income, expense, saved, remaining: income - expense - saved, metrics, notes, medicationDone, medicationTotal };
}
