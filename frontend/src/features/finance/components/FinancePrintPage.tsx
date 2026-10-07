"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { datePart, instantToZoned, timePart } from "@/core/time/zoned";
import { Button, buttonClass, ForbiddenState, Illustration, SkeletonList } from "@/design/components";
import { useActiveSpace, useSpaceToday } from "@/features/members";
import { t } from "@/i18n/vi";
import { useFinance } from "../hooks/useFinance";
import { isYearMonth, monthTitle, signedAmount, txnsInMonth, vnDate } from "../model/finance-view";
import { formatVnd } from "../model/money";
import { monthSummary } from "../model/month-summary";
import { SummaryTable } from "./FinanceReportTab";
import { txnTitle } from "./TxnRow";

/** `/in/tai-chinh?thang=YYYY-MM`: the month's report on paper or "Lưu PDF" from the browser's print dialog. */
export function FinancePrintPage() {
  const params = useSearchParams();
  const today = useSpaceToday();
  const { space } = useActiveSpace();
  const data = useFinance();
  const asked = params.get("thang");
  const month = isYearMonth(asked) ? asked : today.slice(0, 7);
  const summary = useMemo(() => monthSummary(data.txns, data.savings, data.goals, month), [data, month]);
  const txns = useMemo(() => txnsInMonth(data.txns, month), [data.txns, month]);
  const names = new Map(data.members.map((m) => [m.id, m.displayName]));
  const now = instantToZoned(new Date(), space?.timeZone ?? "Asia/Ho_Chi_Minh");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-5 bg-bg px-4 py-6 print:max-w-none print:bg-white print:p-0 print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/tai-chinh/?tab=report&thang=${month}`} className={buttonClass("ghost")}>
          <ArrowLeft aria-hidden className="size-4" />
          {t("finance.report.printBack")}
        </Link>
        {data.forbidden ? null : (
          <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
            {t("print.print")}
          </Button>
        )}
      </div>
      <article className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 print:rounded-none print:border-0 print:p-0" data-testid="print-finance">
        <header className="flex items-center justify-between gap-4 border-b border-border pb-3 print:border-black/30">
          <div className="flex min-w-0 flex-col">
            <h1 className="text-xl font-bold text-text sm:text-2xl print:text-2xl print:text-black">{t("finance.report.printTitle", { month: monthTitle(month) })}</h1>
            <p className="text-sm text-muted print:text-black/70">
              {space?.name} · {t("finance.report.printedAt", { time: `${vnDate(datePart(now))} ${timePart(now) ?? ""}`.trim() })}
            </p>
          </div>
          <div className="hidden shrink-0 sm:block print:block">
            <Illustration name="logo" height={48} />
          </div>
        </header>
        {data.forbidden ? (
          <ForbiddenState body={t("finance.forbidden")} />
        ) : data.loading ? (
          <SkeletonList rows={5} />
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h2 className="text-base font-bold text-text print:text-black">{t("finance.report.summary")}</h2>
              <SummaryTable summary={summary} count={txns.length} />
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="text-base font-bold text-text print:text-black">{t("finance.report.byCategory")}</h2>
              {summary.byCategory.length === 0 ? (
                <p className="text-sm text-muted">{t("finance.donut.empty")}</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {summary.byCategory.map((c) => (
                      <tr key={c.category} className="border-b border-border last:border-0">
                        <th scope="row" className="py-1.5 text-left font-medium text-body print:text-black">
                          {t(`finance.categories.${c.category}`)}
                        </th>
                        <td className="w-16 py-1.5 text-right tabular-nums text-muted print:text-black/70">{String(c.percent).replace(".", ",")}%</td>
                        <td className="w-36 py-1.5 text-right font-semibold tabular-nums print:text-black">{formatVnd(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="text-base font-bold text-text print:text-black">{t("finance.tabs.txns")}</h2>
              {txns.length === 0 ? (
                <p className="text-sm text-muted">{t("finance.recent.empty")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted print:text-black/70">
                      <th scope="col" className="w-24 py-1.5 font-semibold">
                        {t("finance.txn.columns.date")}
                      </th>
                      <th scope="col" className="py-1.5 font-semibold">
                        {t("finance.txn.columns.note")}
                      </th>
                      <th scope="col" className="hidden py-1.5 font-semibold sm:table-cell print:table-cell">
                        {t("finance.txn.columns.category")}
                      </th>
                      <th scope="col" className="w-36 py-1.5 text-right font-semibold">
                        {t("finance.txn.columns.amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((x) => (
                      <tr key={x.id} className="border-b border-border last:border-0 print:break-inside-avoid">
                        <td className="py-1.5 tabular-nums text-body print:text-black">{vnDate(x.date)}</td>
                        <td className="py-1.5 text-text print:text-black">
                          {txnTitle(x)}
                          {x.memberId && names.get(x.memberId) ? <span className="text-muted print:text-black/70"> · {names.get(x.memberId)}</span> : null}
                        </td>
                        <td className="hidden py-1.5 text-body sm:table-cell print:table-cell print:text-black">{t(`finance.categories.${x.category}`)}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums print:text-black">{signedAmount(x)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </article>
    </div>
  );
}
