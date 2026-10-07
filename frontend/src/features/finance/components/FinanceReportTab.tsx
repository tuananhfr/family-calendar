import Link from "next/link";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Button, buttonClass, Card } from "@/design/components";
import { t } from "@/i18n/vi";
import { monthTitle } from "../model/finance-view";
import { formatVnd } from "../model/money";
import type { MonthSummary } from "../model/month-summary";
import { CategoryDonut } from "./CategoryDonut";

export function SummaryTable({ summary, count }: { summary: MonthSummary; count: number }) {
  const rows = [
    [t("finance.kpi.income"), summary.income],
    [t("finance.kpi.expense"), summary.expense],
    [t("finance.kpi.saved"), summary.saved],
    [t("finance.kpi.remaining"), summary.remaining],
  ] as const;
  return (
    <table className="w-full text-sm">
      <caption className="pb-2 text-left text-xs text-muted print:text-black/70">{t("finance.report.count", { n: count })}</caption>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-border last:border-0">
            <th scope="row" className="py-2 text-left font-medium text-body print:text-black">
              {label}
            </th>
            <td className="py-2 text-right font-bold tabular-nums text-text print:text-black">{formatVnd(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "Báo cáo": the month in numbers, Excel download (on-device) and a print page for paper/PDF. */
export function FinanceReportTab({ summary, count, exporting, onExport }: { summary: MonthSummary; count: number; exporting: boolean; onExport: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-text">{t("finance.report.title", { month: monthTitle(summary.month) })}</h2>
        <div className="flex flex-wrap gap-2">
          <Button icon={<FileSpreadsheet className="size-4" />} loading={exporting} onClick={onExport}>
            {exporting ? t("finance.report.exporting") : t("finance.report.exportXlsx")}
          </Button>
          <Link href={`/in/tai-chinh/?thang=${summary.month}`} className={buttonClass("secondary")}>
            <Printer aria-hidden className="size-4" />
            {t("finance.report.print")}
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="flex flex-col gap-2">
          <h3 className="text-base font-bold text-text">{t("finance.report.summary")}</h3>
          <SummaryTable summary={summary} count={count} />
        </Card>
        <Card className="flex flex-col gap-4">
          <h3 className="text-base font-bold text-text">{t("finance.report.byCategory")}</h3>
          <CategoryDonut shares={summary.byCategory} total={summary.expense} monthNumber={Number(summary.month.slice(5, 7))} />
        </Card>
      </div>
    </div>
  );
}
