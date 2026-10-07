"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileDown, Plus, Target, Wallet, WalletCards } from "lucide-react";
import { Card, ForbiddenState, PageHeader, ScriptText, SkeletonList, Tabs } from "@/design/components";
import { useSpaceToday } from "@/features/members";
import { t } from "@/i18n/vi";
import { useFinance } from "../hooks/useFinance";
import { useFinanceExport } from "../hooks/useFinanceExport";
import { budgetRows } from "../model/budget-status";
import { FINANCE_TABS, isYearMonth, txnsInMonth, type FinanceTab } from "../model/finance-view";
import { monthSummary } from "../model/month-summary";
import { BudgetsTab } from "./BudgetsTab";
import { FinanceDialogs, type FinanceDialog } from "./FinanceDialogs";
import { FinanceOverview } from "./FinanceOverview";
import { FinanceReportTab } from "./FinanceReportTab";
import { GoalsTab } from "./GoalsTab";
import { LoansTab } from "./LoansTab";
import { MonthStepper } from "./MonthStepper";
import { SavingsTab } from "./SavingsTab";
import { TxnTable } from "./TxnTable";

// Tabs that are about one month show the stepper; savings, loans and goals span months.
const MONTHLY: FinanceTab[] = ["overview", "txns", "budgets", "report"];

function ActionTile({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 items-center justify-center gap-2.5 rounded-card border border-border bg-surface px-4 text-sm font-semibold text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-5"
    >
      <span aria-hidden>{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/** `/tai-chinh` (IMG-F): month overview, transactions, budgets, savings, loans, goals and the report/export. */
export function FinancePage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = useSpaceToday();
  const data = useFinance();
  const { exportMonth, busy: exporting } = useFinanceExport();
  const [dialog, setDialog] = useState<FinanceDialog | null>(null);

  const askedTab = params.get("tab") as FinanceTab | null;
  const tab: FinanceTab = askedTab && FINANCE_TABS.includes(askedTab) ? askedTab : "overview";
  const askedMonth = params.get("thang");
  const month = isYearMonth(askedMonth) ? askedMonth : today.slice(0, 7);

  // Tab and month live in the URL so back/forward and a shared link land on the same view.
  const go = (next: { tab?: FinanceTab; month?: string }) => {
    const q = new URLSearchParams(params.toString());
    const nextTab = next.tab ?? tab;
    const nextMonth = next.month ?? month;
    if (nextTab === "overview") q.delete("tab");
    else q.set("tab", nextTab);
    if (nextMonth === today.slice(0, 7)) q.delete("thang");
    else q.set("thang", nextMonth);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const summary = useMemo(() => monthSummary(data.txns, data.savings, data.goals, month), [data.txns, data.savings, data.goals, month]);
  const monthTxns = useMemo(() => txnsInMonth(data.txns, month), [data.txns, month]);
  const budgets = useMemo(() => budgetRows(data.budgets, data.txns, month), [data.budgets, data.txns, month]);
  const names = useMemo(() => new Map(data.members.map((m) => [m.id, m.displayName])), [data.members]);
  const exportNow = () => void exportMonth(month, { txns: data.txns, savings: data.savings, goals: data.goals, members: data.members });

  const header = <PageHeader title={t("finance.title")} subtitle={t("finance.subtitle")} icon={<WalletCards />} illustration="corner-finance" />;
  if (data.forbidden)
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Card>
          <ForbiddenState body={t("finance.forbidden")} />
        </Card>
      </div>
    );

  const open = (d: FinanceDialog) => setDialog(d);
  const body = data.loading ? (
    <SkeletonList rows={5} />
  ) : tab === "overview" ? (
    <FinanceOverview summary={summary} monthTxns={monthTxns} names={names} onSeeAll={() => go({ tab: "txns" })} />
  ) : tab === "txns" ? (
    <TxnTable txns={monthTxns} names={names} canEdit={data.canEdit} open={open} />
  ) : tab === "budgets" ? (
    <BudgetsTab rows={budgets} canEdit={data.canEdit} open={open} />
  ) : tab === "savings" ? (
    <SavingsTab savings={data.savings} today={today} canEdit={data.canEdit} open={open} />
  ) : tab === "loans" ? (
    <LoansTab loans={data.loans} canEdit={data.canEdit} open={open} />
  ) : tab === "goals" ? (
    <GoalsTab goals={data.goals} canEdit={data.canEdit} open={open} />
  ) : (
    <FinanceReportTab summary={summary} count={monthTxns.length} exporting={exporting} onExport={exportNow} />
  );

  return (
    <div className="flex flex-col gap-5">
      {header}
      <Tabs label={t("finance.tabsLabel")} value={tab} onValueChange={(v) => go({ tab: v as FinanceTab })} items={FINANCE_TABS.map((x) => ({ value: x, label: t(`finance.tabs.${x}`) }))} />
      {MONTHLY.includes(tab) ? <MonthStepper month={month} onChange={(m) => go({ month: m })} /> : null}
      <section aria-label={t(`finance.tabs.${tab}`)} className="min-w-0">
        {body}
      </section>
      {tab === "overview" && !data.loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {data.canEdit ? (
            <>
              <ActionTile icon={<Plus />} label={t("finance.actions.addTxn")} onClick={() => open({ kind: "txn" })} />
              <ActionTile icon={<Wallet />} label={t("finance.actions.addBudget")} onClick={() => open({ kind: "budget" })} />
              <ActionTile icon={<Target />} label={t("finance.actions.addGoal")} onClick={() => open({ kind: "goal" })} />
            </>
          ) : null}
          <ActionTile icon={<FileDown />} label={t("finance.actions.export")} onClick={exportNow} disabled={exporting} />
        </div>
      ) : null}
      <ScriptText className="self-center lg:hidden">{t("finance.script")}</ScriptText>
      <FinanceDialogs dialog={dialog} data={data} month={month} today={today} onClose={() => setDialog(null)} />
    </div>
  );
}
