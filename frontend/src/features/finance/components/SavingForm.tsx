"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import type { FinanceSaving } from "@/core/model/finance";
import type { LocalDate } from "@/core/time/local-date";
import { DateField, TextField } from "@/design/components";
import { t } from "@/i18n/vi";
import { saveSaving } from "../model/finance-writes";
import { FinanceFormDialog } from "./FinanceFormDialog";
import { MoneyField } from "./MoneyField";

/** "5,5" and "5.5" both mean 5.5% here: a rate is never grouped like money. */
const parseRate = (s: string) => Number(s.trim().replace(",", "."));

export function SavingForm({ spaceId, today, saving, reminderMemberIds, onClose }: { spaceId: string; today: LocalDate; saving?: FinanceSaving; reminderMemberIds: string[]; onClose: () => void }) {
  const [name, setName] = useState(saving?.name ?? "");
  const [bank, setBank] = useState(saving?.bank ?? "");
  const [principal, setPrincipal] = useState<number | undefined>(saving?.principal);
  const [rate, setRate] = useState(saving ? String(saving.ratePercent).replace(".", ",") : "");
  const [start, setStart] = useState<LocalDate>(saving?.startDate ?? today);
  const [term, setTerm] = useState(saving ? String(saving.termMonths) : "12");
  return (
    <FinanceFormDialog
      title={t(saving ? "finance.saving.editTitle" : "finance.saving.addTitle")}
      icon={<Landmark />}
      submitLabel={t("finance.saving.save")}
      onClose={onClose}
      onSubmit={async () => {
        await saveSaving(
          spaceId,
          { name, bank: bank.trim() || undefined, principal: principal ?? 0, ratePercent: rate.trim() ? parseRate(rate) : Number.NaN, startDate: start, termMonths: Number(term) },
          { memberIds: reminderMemberIds },
          saving?.id,
        );
        return t("finance.saving.saved");
      }}
    >
      {(errors, clear) => (
        <>
          <TextField
            label={t("finance.saving.name")}
            required
            autoFocus
            maxLength={100}
            value={name}
            placeholder={t("finance.saving.namePlaceholder")}
            onChange={(e) => {
              setName(e.target.value);
              clear("name");
            }}
            error={errors.name}
          />
          <TextField label={t("finance.saving.bank")} optional maxLength={100} value={bank} onChange={(e) => setBank(e.target.value)} error={errors.bank} />
          <MoneyField
            label={t("finance.saving.principal")}
            required
            value={principal}
            onChange={(v) => {
              setPrincipal(v);
              clear("principal");
            }}
            error={errors.principal}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t("finance.saving.rate")}
              required
              inputMode="decimal"
              value={rate}
              placeholder="5,5"
              onChange={(e) => {
                setRate(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6));
                clear("ratePercent");
              }}
              error={errors.ratePercent}
            />
            <TextField
              label={t("finance.saving.term")}
              required
              inputMode="numeric"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value.replace(/\D/g, "").slice(0, 3));
                clear("termMonths");
              }}
              error={errors.termMonths}
            />
          </div>
          <DateField label={t("finance.saving.start")} required value={start} onChange={(e) => setStart(e.target.value)} error={errors.startDate} />
        </>
      )}
    </FinanceFormDialog>
  );
}
