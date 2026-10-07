"use client";

import { useState } from "react";
import { PiggyBank } from "lucide-react";
import { EXPENSE_CATEGORIES, type ExpenseCategory, type FinanceBudget } from "@/core/model/finance";
import { Select } from "@/design/components";
import { t } from "@/i18n/vi";
import { monthTitle } from "../model/finance-view";
import { saveBudget } from "../model/finance-writes";
import { FinanceFormDialog } from "./FinanceFormDialog";
import { MoneyField } from "./MoneyField";

export function BudgetForm({ spaceId, month, budget, taken, onClose }: { spaceId: string; month: string; budget?: FinanceBudget; taken: ExpenseCategory[]; onClose: () => void }) {
  const free = EXPENSE_CATEGORIES.filter((c) => c === budget?.category || !taken.includes(c));
  const [category, setCategory] = useState<ExpenseCategory>(budget?.category ?? free[0] ?? "OTHER");
  const [limit, setLimit] = useState<number | undefined>(budget?.limitAmount);
  return (
    <FinanceFormDialog
      title={`${t(budget ? "finance.budget.editTitle" : "finance.budget.addTitle")} · ${monthTitle(budget?.month ?? month)}`}
      icon={<PiggyBank />}
      submitLabel={t("finance.budget.save")}
      onClose={onClose}
      onSubmit={async () => {
        await saveBudget(spaceId, { month: budget?.month ?? month, category, limitAmount: limit ?? 0 }, budget?.id);
        return t("finance.budget.saved");
      }}
    >
      {(errors, clear) => (
        <>
          <Select
            label={t("finance.budget.category")}
            required
            value={category}
            onValueChange={(v) => {
              setCategory(v as ExpenseCategory);
              clear("category");
            }}
            options={free.map((c) => ({ value: c, label: t(`finance.categories.${c}`) }))}
            error={errors.category}
          />
          <MoneyField
            label={t("finance.budget.limit")}
            required
            value={limit}
            onChange={(v) => {
              setLimit(v);
              clear("limitAmount");
            }}
            error={errors.limitAmount}
          />
        </>
      )}
    </FinanceFormDialog>
  );
}
