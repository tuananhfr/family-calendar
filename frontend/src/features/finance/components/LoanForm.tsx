"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import type { FinanceLoan } from "@/core/model/finance";
import type { LocalDate } from "@/core/time/local-date";
import { ChipGroup, DateField, TextField } from "@/design/components";
import { t } from "@/i18n/vi";
import { saveLoan } from "../model/finance-writes";
import { FinanceFormDialog } from "./FinanceFormDialog";
import { MoneyField } from "./MoneyField";

type Direction = FinanceLoan["direction"];

export function LoanForm({ spaceId, today, loan, reminderMemberIds, onClose }: { spaceId: string; today: LocalDate; loan?: FinanceLoan; reminderMemberIds: string[]; onClose: () => void }) {
  const [direction, setDirection] = useState<Direction>(loan?.direction ?? "BORROWED");
  const [counterparty, setCounterparty] = useState(loan?.counterparty ?? "");
  const [principal, setPrincipal] = useState<number | undefined>(loan?.principal);
  const [start, setStart] = useState<LocalDate>(loan?.startDate ?? today);
  const [due, setDue] = useState(loan?.dueDate ?? "");
  const [note, setNote] = useState(loan?.note ?? "");
  return (
    <FinanceFormDialog
      title={t(loan ? "finance.loan.editTitle" : "finance.loan.addTitle")}
      icon={<HandCoins />}
      submitLabel={t("finance.loan.save")}
      onClose={onClose}
      onSubmit={async () => {
        await saveLoan(
          spaceId,
          { direction, counterparty, principal: principal ?? 0, startDate: start, dueDate: due || undefined, note: note.trim() || undefined, payments: loan?.payments ?? [] },
          { memberIds: reminderMemberIds },
          loan?.id,
        );
        return t("finance.loan.saved");
      }}
    >
      {(errors, clear) => (
        <>
          <ChipGroup
            label={t("finance.loan.direction")}
            value={direction}
            onChange={setDirection}
            options={(["BORROWED", "LENT"] as const).map((v) => ({ value: v, label: t(`finance.loan.directions.${v}`) }))}
          />
          <TextField
            label={t("finance.loan.counterparty")}
            required
            autoFocus
            maxLength={100}
            value={counterparty}
            placeholder={t("finance.loan.counterpartyPlaceholder")}
            onChange={(e) => {
              setCounterparty(e.target.value);
              clear("counterparty");
            }}
            error={errors.counterparty}
          />
          <MoneyField
            label={t("finance.loan.principal")}
            required
            value={principal}
            onChange={(v) => {
              setPrincipal(v);
              clear("principal");
            }}
            error={errors.principal}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label={t("finance.loan.start")} required value={start} onChange={(e) => setStart(e.target.value)} error={errors.startDate} />
            <DateField
              label={t("finance.loan.due")}
              optional
              value={due}
              onChange={(e) => {
                setDue(e.target.value);
                clear("dueDate");
              }}
              error={errors.dueDate}
            />
          </div>
          <TextField label={t("finance.loan.note")} optional maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} />
        </>
      )}
    </FinanceFormDialog>
  );
}
