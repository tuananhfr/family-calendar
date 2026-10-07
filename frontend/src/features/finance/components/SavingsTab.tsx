import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import type { FinanceSaving } from "@/core/model/finance";
import type { LocalDate } from "@/core/time/local-date";
import { Badge, Button, Card, EmptyState, IconButton } from "@/design/components";
import { t } from "@/i18n/vi";
import { formatVnd, sumMoney, toMoney } from "../model/money";
import { savingStatus } from "../model/saving-maturity";
import { vnDate } from "../model/finance-view";
import type { FinanceDialog } from "./FinanceDialogs";

export function SavingsTab({ savings, today, canEdit, open }: { savings: FinanceSaving[]; today: LocalDate; canEdit: boolean; open: (d: FinanceDialog) => void }) {
  const add = canEdit ? (
    <Button icon={<Plus className="size-4" />} onClick={() => open({ kind: "saving" })}>
      {t("finance.saving.add")}
    </Button>
  ) : null;
  if (savings.length === 0) return <EmptyState className="rounded-card border border-dashed border-border" title={t("finance.saving.empty")} body={t("finance.saving.emptyBody")} action={add} />;

  // Soonest maturity first: that is the one the family has to act on.
  const rows = savings.map((s) => ({ saving: s, ...savingStatus(s, today) })).sort((a, b) => a.maturity.localeCompare(b.maturity));
  const total = sumMoney(savings.map((s) => toMoney(s.principal)));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-body">
          {t("finance.saving.total")}: <span className="font-bold tabular-nums text-text">{formatVnd(total)}</span>
        </p>
        {add}
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="saving-list">
        {rows.map(({ saving, maturity, daysLeft, matured }) => (
          <li key={saving.id}>
            <Card className="flex h-full flex-col gap-3">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-[var(--cat-finance-bg)] text-[var(--cat-finance-dot)] [&_svg]:size-5">
                  <Landmark />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text">{saving.name}</p>
                  {saving.bank ? <p className="truncate text-xs text-muted">{saving.bank}</p> : null}
                </div>
                <Badge tone={matured ? "success" : daysLeft <= 7 ? "warning" : "neutral"}>{matured ? t("finance.saving.matured") : t("finance.saving.daysLeft", { n: daysLeft })}</Badge>
              </div>
              <p className="text-xl font-bold tabular-nums text-text">{formatVnd(toMoney(saving.principal))}</p>
              <div className="mt-auto flex items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  {t("finance.saving.meta", { rate: String(saving.ratePercent).replace(".", ","), term: saving.termMonths })} · {t("finance.saving.maturity", { date: vnDate(maturity) })}
                </p>
                {canEdit ? (
                  <span className="flex shrink-0 gap-1">
                    <IconButton label={`${t("finance.txn.edit")} “${saving.name}”`} icon={<Pencil className="size-4" />} onClick={() => open({ kind: "saving", saving })} />
                    <IconButton
                      label={`${t("finance.txn.delete")} “${saving.name}”`}
                      icon={<Trash2 className="size-4" />}
                      onClick={() =>
                        open({
                          kind: "delete",
                          request: { type: "finance_saving", id: saving.id, question: t("finance.saving.confirmDelete", { name: saving.name }), done: t("finance.saving.deleted") },
                        })
                      }
                    />
                  </span>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
