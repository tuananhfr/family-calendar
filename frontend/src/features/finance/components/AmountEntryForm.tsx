"use client";

import { useState, type ReactNode } from "react";
import type { LocalDate } from "@/core/time/local-date";
import { DateField } from "@/design/components";
import { FinanceFormError } from "../model/finance-writes";
import { FinanceFormDialog } from "./FinanceFormDialog";
import { MoneyField } from "./MoneyField";

/** One dated amount appended to a list: a loan payment or a goal contribution. */
export function AmountEntryForm({
  title,
  icon,
  amountLabel,
  dateLabel,
  submitLabel,
  today,
  max,
  onSave,
  onClose,
}: {
  title: string;
  icon: ReactNode;
  amountLabel: string;
  dateLabel: string;
  submitLabel: string;
  today: LocalDate;
  /** Paying more than is owed is almost always a typo (an extra 0). */
  max?: number;
  onSave: (entry: { date: LocalDate; amount: number }) => Promise<string>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<number>();
  const [date, setDate] = useState<LocalDate>(today);
  return (
    <FinanceFormDialog
      title={title}
      icon={icon}
      submitLabel={submitLabel}
      onClose={onClose}
      onSubmit={async () => {
        if (!amount) throw new FinanceFormError({ amount: "AMOUNT_NOT_POSITIVE" });
        if (max !== undefined && amount > max) throw new FinanceFormError({ amount: "AMOUNT_OVER_MAX" });
        return onSave({ date, amount });
      }}
    >
      {(errors, clear) => (
        <>
          <MoneyField
            label={amountLabel}
            required
            autoFocus
            value={amount}
            onChange={(v) => {
              setAmount(v);
              clear("amount");
            }}
            error={errors.amount}
          />
          <DateField label={dateLabel} required value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        </>
      )}
    </FinanceFormDialog>
  );
}
