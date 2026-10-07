import { Pencil, Plus, Trash2 } from "lucide-react";
import type { FinanceBudget } from "@/core/model/finance";
import { Badge, Button, Card, EmptyState, IconButton, ProgressBar } from "@/design/components";
import type { Tone } from "@/design/tones";
import { t } from "@/i18n/vi";
import type { BudgetRow, BudgetStatus } from "../model/budget-status";
import { formatVnd, toMoney } from "../model/money";
import { CATEGORY_ICON } from "./category-icon";
import type { FinanceDialog } from "./FinanceDialogs";
import { categoryTone } from "../model/finance-view";

const STATUS_TONE: Record<BudgetStatus, Tone> = { OK: "success", WARN_80: "warning", OVER: "danger" };
const STATUS_BAR: Record<BudgetStatus, string> = { OK: "--color-success", WARN_80: "--color-warning", OVER: "--color-danger" };

export function BudgetsTab({ rows, canEdit, open }: { rows: BudgetRow[]; canEdit: boolean; open: (d: FinanceDialog) => void }) {
  const name = (b: FinanceBudget) => t(`finance.categories.${b.category}`);
  const add = canEdit ? (
    <Button icon={<Plus className="size-4" />} onClick={() => open({ kind: "budget" })}>
      {t("finance.actions.addBudget")}
    </Button>
  ) : null;
  if (rows.length === 0) return <EmptyState className="rounded-card border border-dashed border-border" title={t("finance.budget.empty")} body={t("finance.budget.emptyBody")} action={add} />;

  return (
    <div className="flex flex-col gap-4">
      {add ? <div className="flex justify-end">{add}</div> : null}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="budget-list">
        {rows.map(({ budget, spent, percent, status }) => {
          const Icon = CATEGORY_ICON[budget.category];
          const tone = categoryTone(budget.category);
          const diff = toMoney(budget.limitAmount) - spent;
          return (
            <li key={budget.id}>
              <Card className="flex flex-col gap-3" data-testid="budget-row">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-control [&_svg]:size-5"
                    style={{ background: `var(--cat-${tone}-bg)`, color: `var(--cat-${tone}-dot)` }}
                  >
                    <Icon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text">{name(budget)}</p>
                    <p className="text-xs tabular-nums text-muted">{t("finance.budget.spent", { spent: formatVnd(spent), limit: formatVnd(toMoney(budget.limitAmount)) })}</p>
                  </div>
                  <Badge tone={STATUS_TONE[status]}>{t(`finance.budget.status.${status}`)}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar value={percent} label={name(budget)} colorVar={STATUS_BAR[status]} showValue={false} className="flex-1" />
                  {/* The bar stops at 100%; the number doesn't, so 111% still reads as over. */}
                  <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-text">{percent}%</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={status === "OVER" ? "text-sm font-semibold text-danger" : "text-sm text-body"}>
                    {diff >= BigInt(0) ? t("finance.budget.left", { amount: formatVnd(diff) }) : t("finance.budget.over", { amount: formatVnd(-diff) })}
                  </p>
                  {canEdit ? (
                    <span className="flex gap-1">
                      <IconButton label={`${t("finance.txn.edit")} “${name(budget)}”`} icon={<Pencil className="size-4" />} onClick={() => open({ kind: "budget", budget })} />
                      <IconButton
                        label={`${t("finance.txn.delete")} “${name(budget)}”`}
                        icon={<Trash2 className="size-4" />}
                        onClick={() =>
                          open({
                            kind: "delete",
                            request: { type: "finance_budget", id: budget.id, question: t("finance.budget.confirmDelete", { name: name(budget) }), done: t("finance.budget.deleted") },
                          })
                        }
                      />
                    </span>
                  ) : null}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
