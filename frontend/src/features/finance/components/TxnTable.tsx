"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { FinanceTxn } from "@/core/model/finance";
import { normalizeVi } from "@/core/search";
import { cn } from "@/design/cn";
import { Button, ChipGroup, controlClass, DataTable, EmptyState, IconButton, type Column } from "@/design/components";
import { t } from "@/i18n/vi";
import type { FinanceDialog } from "./FinanceDialogs";
import { shortDate, TxnAmount, TxnIcon, TxnRow, txnTitle } from "./TxnRow";

type Filter = "ALL" | "EXPENSE" | "INCOME";

/** "Thu chi" tab: the month's transactions, filter by type, search, edit/delete for editors. */
export function TxnTable({ txns, names, canEdit, open }: { txns: FinanceTxn[]; names: Map<string, string>; canEdit: boolean; open: (d: FinanceDialog) => void }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = normalizeVi(query.trim());
    return txns.filter(
      (x) => (filter === "ALL" || x.type === filter) && (!q || normalizeVi(`${x.note ?? ""} ${t(`finance.categories.${x.category}`)} ${x.memberId ? (names.get(x.memberId) ?? "") : ""}`).includes(q)),
    );
  }, [txns, filter, query, names]);

  // Transfers come only from sync (no accounts screen in V1); editing them here would turn them into expenses.
  const editable = (x: FinanceTxn) => canEdit && x.type !== "TRANSFER";
  const remove = (x: FinanceTxn) =>
    open({ kind: "delete", request: { type: "finance_txn", id: x.id, question: t("finance.txn.confirmDelete", { name: txnTitle(x) }), done: t("finance.txn.deleted") } });
  const actions = (x: FinanceTxn) =>
    editable(x) ? (
      <span className="flex shrink-0 justify-end">
        <IconButton label={`${t("finance.txn.edit")} “${txnTitle(x)}”`} icon={<Pencil className="size-4" />} variant="ghost" onClick={() => open({ kind: "txn", txn: x })} />
        <IconButton label={`${t("finance.txn.delete")} “${txnTitle(x)}”`} icon={<Trash2 className="size-4" />} variant="ghost" onClick={() => remove(x)} />
      </span>
    ) : null;

  const columns: Column<FinanceTxn>[] = [
    { key: "date", header: t("finance.txn.columns.date"), className: "w-20", render: (x) => <span className="tabular-nums text-body">{shortDate(x.date)}</span> },
    {
      key: "note",
      header: t("finance.txn.columns.note"),
      render: (x) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <TxnIcon txn={x} />
          <span className="truncate font-semibold text-text">{txnTitle(x)}</span>
        </span>
      ),
    },
    { key: "category", header: t("finance.txn.columns.category"), className: "w-36", render: (x) => <span className="truncate text-body">{t(`finance.categories.${x.category}`)}</span> },
    { key: "member", header: t("finance.txn.columns.member"), className: "w-32", render: (x) => <span className="truncate text-body">{x.memberId ? names.get(x.memberId) : "—"}</span> },
    { key: "amount", header: t("finance.txn.columns.amount"), className: "w-40 text-right", render: (x) => <TxnAmount txn={x} /> },
    ...(canEdit ? [{ key: "actions", header: t("finance.txn.columns.actions"), srOnlyHeader: true, className: "w-28", render: actions }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ChipGroup
          label={t("finance.txn.filterLabel")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ALL", label: t("finance.txn.filterAll") },
            { value: "EXPENSE", label: t("finance.txnTypes.EXPENSE") },
            { value: "INCOME", label: t("finance.txnTypes.INCOME") },
          ]}
        />
        <label className="relative flex min-w-[12rem] flex-1 items-center">
          <span className="sr-only">{t("finance.txn.searchLabel")}</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("finance.txn.search")} className={cn(controlClass, "pl-9")} />
        </label>
        {canEdit ? (
          <Button icon={<Plus className="size-4" />} onClick={() => open({ kind: "txn" })}>
            {t("finance.actions.addTxn")}
          </Button>
        ) : null}
      </div>
      <DataTable
        caption={t("finance.txn.caption")}
        columns={columns}
        rows={rows}
        rowKey={(x) => x.id}
        minWidth="44rem"
        empty={
          <EmptyState
            className="rounded-card border border-dashed border-border"
            title={txns.length === 0 ? t("finance.txn.empty") : t("finance.txn.noMatch")}
            body={txns.length === 0 ? t("finance.txn.emptyBody") : undefined}
          />
        }
        mobileCard={(x) => (
          // Actions get their own row: beside the amount they squeeze the title to one letter on a 360px phone.
          <div className="flex flex-col">
            <TxnRow txn={x} memberName={x.memberId ? names.get(x.memberId) : undefined} />
            {editable(x) ? <div className="flex justify-end border-t border-border pt-1">{actions(x)}</div> : null}
          </div>
        )}
      />
    </div>
  );
}
