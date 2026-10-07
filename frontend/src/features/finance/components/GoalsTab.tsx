import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import type { FinanceGoal } from "@/core/model/finance";
import { Badge, Button, Card, EmptyState, IconButton, ProgressBar } from "@/design/components";
import { t } from "@/i18n/vi";
import { goalProgress } from "../model/goal-progress";
import { formatVnd, toMoney } from "../model/money";
import { vnDate } from "../model/finance-view";
import type { FinanceDialog } from "./FinanceDialogs";

export function GoalsTab({ goals, canEdit, open }: { goals: FinanceGoal[]; canEdit: boolean; open: (d: FinanceDialog) => void }) {
  const add = canEdit ? (
    <Button icon={<Plus className="size-4" />} onClick={() => open({ kind: "goal" })}>
      {t("finance.actions.addGoal")}
    </Button>
  ) : null;
  if (goals.length === 0) return <EmptyState className="rounded-card border border-dashed border-border" title={t("finance.goal.empty")} body={t("finance.goal.emptyBody")} action={add} />;

  return (
    <div className="flex flex-col gap-4">
      {add ? <div className="flex justify-end">{add}</div> : null}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="goal-list">
        {goals.map((goal) => {
          const { saved, percent } = goalProgress(goal);
          const done = percent >= 100;
          return (
            <li key={goal.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary [&_svg]:size-5">
                    <Target />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold text-text">{goal.name}</p>
                    {goal.deadline ? <p className="text-xs text-muted">{t("finance.goal.deadlineOn", { date: vnDate(goal.deadline) })}</p> : null}
                  </div>
                  {done ? <Badge tone="success">{t("finance.goal.done")}</Badge> : null}
                </div>
                <p className="text-sm tabular-nums text-body">
                  <span className="text-lg font-bold text-text">{formatVnd(saved)}</span> / {formatVnd(toMoney(goal.targetAmount))}
                </p>
                <ProgressBar value={percent} label={t("finance.goal.progressLabel", { name: goal.name })} colorVar="--color-success" />
                {canEdit ? (
                  <div className="mt-auto flex items-center justify-between gap-2">
                    {done ? (
                      <span />
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => open({ kind: "contribute", goal })}>
                        {t("finance.goal.contribute")}
                      </Button>
                    )}
                    <span className="flex gap-1">
                      <IconButton label={`${t("finance.txn.edit")} “${goal.name}”`} icon={<Pencil className="size-4" />} onClick={() => open({ kind: "goal", goal })} />
                      <IconButton
                        label={`${t("finance.txn.delete")} “${goal.name}”`}
                        icon={<Trash2 className="size-4" />}
                        onClick={() =>
                          open({ kind: "delete", request: { type: "finance_goal", id: goal.id, question: t("finance.goal.confirmDelete", { name: goal.name }), done: t("finance.goal.deleted") } })
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
