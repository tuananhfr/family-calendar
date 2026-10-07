"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { categoriesForTxnType, type FinanceCategory, type FinanceTxn, type FinanceTxnType } from "@/core/model/finance";
import type { Member } from "@/core/model/member";
import type { LocalDate } from "@/core/time/local-date";
import { ChipGroup, DateField, Select, TextField } from "@/design/components";
import { t } from "@/i18n/vi";
import { saveTxn } from "../model/finance-writes";
import { FinanceFormDialog } from "./FinanceFormDialog";
import { MoneyField } from "./MoneyField";

// Transfers need accounts, which V1 screens don't manage; they can still arrive from sync and are shown read-only.
const FORM_TYPES = ["EXPENSE", "INCOME"] as const satisfies readonly FinanceTxnType[];
const NO_MEMBER = "__all";

export function TxnForm({ spaceId, members, today, txn, onClose }: { spaceId: string; members: Member[]; today: LocalDate; txn?: FinanceTxn; onClose: () => void }) {
  const [type, setType] = useState<"EXPENSE" | "INCOME">(txn?.type === "INCOME" ? "INCOME" : "EXPENSE");
  const [amount, setAmount] = useState<number | undefined>(txn?.amount);
  const [category, setCategory] = useState<FinanceCategory>(txn?.category ?? "FOOD");
  const [date, setDate] = useState<LocalDate>(txn?.date ?? today);
  const [memberId, setMemberId] = useState(txn?.memberId ?? NO_MEMBER);
  const [note, setNote] = useState(txn?.note ?? "");
  const categories = categoriesForTxnType(type);

  return (
    <FinanceFormDialog
      title={t(txn ? "finance.txn.editTitle" : "finance.txn.addTitle")}
      icon={<ArrowLeftRight />}
      submitLabel={t("finance.txn.save")}
      onClose={onClose}
      onSubmit={async () => {
        await saveTxn(
          spaceId,
          {
            ...(txn?.itemId ? { itemId: txn.itemId } : {}),
            type,
            amount: amount ?? 0,
            category,
            date,
            memberId: memberId === NO_MEMBER ? undefined : memberId,
            note: note.trim() || undefined,
          },
          txn?.id,
        );
        return t("finance.txn.saved");
      }}
    >
      {(errors, clear) => (
        <>
          <ChipGroup
            label={t("finance.txn.type")}
            value={type}
            onChange={(v) => {
              setType(v);
              // Keep the category when it exists for both types ("Khác"); otherwise pick the first of the new list.
              if (!categoriesForTxnType(v).includes(category)) setCategory(categoriesForTxnType(v)[0]);
              clear("category");
            }}
            options={FORM_TYPES.map((v) => ({ value: v, label: t(`finance.txnTypes.${v}`) }))}
          />
          <MoneyField
            label={t("finance.txn.amount")}
            required
            autoFocus
            value={amount}
            onChange={(v) => {
              setAmount(v);
              clear("amount");
            }}
            error={errors.amount}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t("finance.txn.category")}
              required
              value={category}
              onValueChange={(v) => {
                setCategory(v as FinanceCategory);
                clear("category");
              }}
              options={categories.map((c) => ({ value: c, label: t(`finance.categories.${c}`) }))}
              error={errors.category}
            />
            <DateField label={t("finance.txn.date")} required value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
          </div>
          <Select
            label={t("finance.txn.member")}
            value={memberId}
            onValueChange={setMemberId}
            options={[{ value: NO_MEMBER, label: t("finance.txn.memberNone") }, ...members.map((m) => ({ value: m.id, label: m.displayName }))]}
          />
          <TextField
            label={t("finance.txn.note")}
            optional
            maxLength={500}
            value={note}
            placeholder={t("finance.txn.notePlaceholder")}
            onChange={(e) => {
              setNote(e.target.value);
              clear("note");
            }}
            error={errors.note}
          />
        </>
      )}
    </FinanceFormDialog>
  );
}
