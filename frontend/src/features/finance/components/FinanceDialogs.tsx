"use client";

import { HandCoins, PiggyBank } from "lucide-react";
import type { FinanceBudget, FinanceGoal, FinanceLoan, FinanceSaving, FinanceTxn } from "@/core/model/finance";
import type { LocalDate } from "@/core/time/local-date";
import { t } from "@/i18n/vi";
import { addGoalContribution, addLoanPayment } from "../model/finance-writes";
import { goalProgress } from "../model/goal-progress";
import { loanOutstanding } from "../model/loan-balance";
import type { FinanceData } from "../hooks/useFinance";
import { AmountEntryForm } from "./AmountEntryForm";
import { BudgetForm } from "./BudgetForm";
import { ConfirmDelete, type DeleteRequest } from "./ConfirmDelete";
import { GoalForm } from "./GoalForm";
import { LoanForm } from "./LoanForm";
import { SavingForm } from "./SavingForm";
import { TxnForm } from "./TxnForm";

export type FinanceDialog =
  | { kind: "txn"; txn?: FinanceTxn }
  | { kind: "budget"; budget?: FinanceBudget }
  | { kind: "saving"; saving?: FinanceSaving }
  | { kind: "loan"; loan?: FinanceLoan }
  | { kind: "goal"; goal?: FinanceGoal }
  | { kind: "payment"; loan: FinanceLoan }
  | { kind: "contribute"; goal: FinanceGoal }
  | { kind: "delete"; request: DeleteRequest };

/** Exactly one finance dialog at a time, opened by any tab through `FinancePage`. */
export function FinanceDialogs({ dialog, data, month, today, onClose }: { dialog: FinanceDialog | null; data: FinanceData; month: string; today: LocalDate; onClose: () => void }) {
  const spaceId = data.spaceId;
  if (!dialog || !spaceId) return null;
  switch (dialog.kind) {
    case "txn":
      return <TxnForm spaceId={spaceId} members={data.members} today={today} txn={dialog.txn} onClose={onClose} />;
    case "budget":
      return <BudgetForm spaceId={spaceId} month={month} budget={dialog.budget} taken={data.budgets.filter((b) => b.month === month).map((b) => b.category)} onClose={onClose} />;
    case "saving":
      return <SavingForm spaceId={spaceId} today={today} saving={dialog.saving} reminderMemberIds={data.reminderMemberIds} onClose={onClose} />;
    case "loan":
      return <LoanForm spaceId={spaceId} today={today} loan={dialog.loan} reminderMemberIds={data.reminderMemberIds} onClose={onClose} />;
    case "goal":
      return <GoalForm spaceId={spaceId} goal={dialog.goal} onClose={onClose} />;
    case "payment":
      return (
        <AmountEntryForm
          title={t("finance.loan.paymentTitle", { name: dialog.loan.counterparty })}
          icon={<HandCoins />}
          amountLabel={t("finance.loan.paymentAmount")}
          dateLabel={t("finance.loan.paymentDate")}
          submitLabel={t("finance.loan.addPayment")}
          today={today}
          max={Number(loanOutstanding(dialog.loan))}
          onSave={async (entry) => {
            await addLoanPayment(dialog.loan.id, entry);
            return t("finance.loan.paymentSaved");
          }}
          onClose={onClose}
        />
      );
    case "contribute": {
      const left = dialog.goal.targetAmount - Number(goalProgress(dialog.goal).saved);
      return (
        <AmountEntryForm
          title={t("finance.goal.contributeTitle", { name: dialog.goal.name })}
          icon={<PiggyBank />}
          amountLabel={t("finance.goal.contributeAmount")}
          dateLabel={t("finance.goal.contributeDate")}
          submitLabel={t("finance.goal.contribute")}
          today={today}
          max={left > 0 ? left : undefined}
          onSave={async (entry) => {
            await addGoalContribution(dialog.goal.id, entry);
            return t("finance.goal.contributed");
          }}
          onClose={onClose}
        />
      );
    }
    case "delete":
      return <ConfirmDelete request={dialog.request} onClose={onClose} />;
  }
}
