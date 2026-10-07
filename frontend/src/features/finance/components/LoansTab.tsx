import { HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
import type { FinanceLoan } from "@/core/model/finance";
import { Badge, Button, Card, EmptyState, IconButton, ProgressBar } from "@/design/components";
import { t } from "@/i18n/vi";
import { loanOutstanding, loanPaid } from "../model/loan-balance";
import { formatVnd, toMoney } from "../model/money";
import { vnDate } from "../model/finance-view";
import type { FinanceDialog } from "./FinanceDialogs";

export function LoansTab({ loans, canEdit, open }: { loans: FinanceLoan[]; canEdit: boolean; open: (d: FinanceDialog) => void }) {
  const add = canEdit ? (
    <Button icon={<Plus className="size-4" />} onClick={() => open({ kind: "loan" })}>
      {t("finance.loan.add")}
    </Button>
  ) : null;
  if (loans.length === 0) return <EmptyState className="rounded-card border border-dashed border-border" title={t("finance.loan.empty")} body={t("finance.loan.emptyBody")} action={add} />;

  // Open loans first, nearest due date first; paid-off ones sink to the bottom.
  const rows = loans
    .map((loan) => ({ loan, outstanding: loanOutstanding(loan), paid: loanPaid(loan) }))
    .sort((a, b) => Number(a.outstanding === BigInt(0)) - Number(b.outstanding === BigInt(0)) || (a.loan.dueDate ?? "9999").localeCompare(b.loan.dueDate ?? "9999"));
  return (
    <div className="flex flex-col gap-4">
      {add ? <div className="flex justify-end">{add}</div> : null}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="loan-list">
        {rows.map(({ loan, outstanding, paid }) => {
          const done = outstanding === BigInt(0);
          const percent = Number((paid * BigInt(100)) / toMoney(loan.principal));
          return (
            <li key={loan.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-[var(--cat-shopping-bg)] text-[var(--cat-shopping-dot)] [&_svg]:size-5">
                    <HandCoins />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text">{loan.counterparty}</p>
                    <p className="text-xs text-muted">{t(`finance.loan.directions.${loan.direction}`)}</p>
                  </div>
                  {loan.dueDate ? <Badge tone={done ? "neutral" : "warning"}>{t("finance.loan.dueOn", { date: vnDate(loan.dueDate) })}</Badge> : null}
                </div>
                <p className={done ? "text-base font-bold text-success" : "text-xl font-bold tabular-nums text-text"}>
                  {done ? t("finance.loan.paidOff") : t("finance.loan.outstanding", { amount: formatVnd(outstanding) })}
                </p>
                <ProgressBar value={percent} label={loan.counterparty} colorVar="--color-primary" />
                <p className="text-xs tabular-nums text-muted">{t("finance.loan.paid", { paid: formatVnd(paid), principal: formatVnd(toMoney(loan.principal)) })}</p>
                {canEdit ? (
                  <div className="mt-auto flex items-center justify-between gap-2">
                    {done ? (
                      <span />
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => open({ kind: "payment", loan })}>
                        {t("finance.loan.addPayment")}
                      </Button>
                    )}
                    <span className="flex gap-1">
                      <IconButton label={`${t("finance.txn.edit")} “${loan.counterparty}”`} icon={<Pencil className="size-4" />} onClick={() => open({ kind: "loan", loan })} />
                      <IconButton
                        label={`${t("finance.txn.delete")} “${loan.counterparty}”`}
                        icon={<Trash2 className="size-4" />}
                        onClick={() =>
                          open({
                            kind: "delete",
                            request: { type: "finance_loan", id: loan.id, question: t("finance.loan.confirmDelete", { name: loan.counterparty }), done: t("finance.loan.deleted") },
                          })
                        }
                      />
                    </span>
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
