import { ArrowRight, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { FinanceTxn } from "@/core/model/finance";
import { Card } from "@/design/components";
import { t } from "@/i18n/vi";
import { formatVnd } from "../model/money";
import type { MonthSummary } from "../model/month-summary";
import { CategoryDonut } from "./CategoryDonut";
import { KpiCard } from "./KpiCard";
import { TxnRow } from "./TxnRow";

const RECENT_COUNT = 5;

export function FinanceOverview({ summary, monthTxns, names, onSeeAll }: { summary: MonthSummary; monthTxns: FinanceTxn[]; names: Map<string, string>; onSeeAll: () => void }) {
  const d = summary.deltaVsPrev;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="finance-kpis">
        <KpiCard testId="kpi-income" label={t("finance.kpi.income")} value={formatVnd(summary.income)} delta={d.income} tone="activity" icon={<TrendingUp />} />
        <KpiCard testId="kpi-expense" label={t("finance.kpi.expense")} value={formatVnd(summary.expense)} delta={d.expense} tone="health" icon={<TrendingDown />} higherIsBetter={false} />
        <KpiCard testId="kpi-saved" label={t("finance.kpi.saved")} value={formatVnd(summary.saved)} delta={d.saved} tone="finance" icon={<PiggyBank />} />
        <KpiCard
          testId="kpi-remaining"
          label={t("finance.kpi.remaining")}
          value={formatVnd(summary.remaining)}
          delta={d.remaining}
          tone="study"
          icon={<Wallet />}
          hint={t("finance.kpi.remainingHint")}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="flex min-w-0 flex-col gap-4">
          <h2 className="text-base font-bold text-text">{t("finance.donut.title")}</h2>
          <CategoryDonut shares={summary.byCategory} total={summary.expense} monthNumber={Number(summary.month.slice(5, 7))} />
        </Card>
        <Card className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-text">{t("finance.recent.title")}</h2>
            <button
              type="button"
              onClick={onSeeAll}
              className="inline-flex min-h-9 items-center gap-1 rounded-control bg-primary-soft px-3 text-xs font-semibold text-primary hover:bg-primary hover:text-on-primary"
            >
              {t("finance.recent.all")}
              <ArrowRight aria-hidden className="size-3.5" />
            </button>
          </div>
          {monthTxns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{t("finance.recent.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border" data-testid="recent-txns">
              {monthTxns.slice(0, RECENT_COUNT).map((txn) => (
                <li key={txn.id}>
                  <TxnRow txn={txn} memberName={txn.memberId ? names.get(txn.memberId) : undefined} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
