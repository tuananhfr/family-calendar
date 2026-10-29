import type { MonthReport } from "../model/report-month";
import { t } from "@/i18n/vi";
import { Card } from "@/design/components";

export function ReportCharts({ report, categories = true, members = true }: { report: MonthReport; categories?: boolean; members?: boolean }) {
  const circumference = 2 * Math.PI * 60;
  const max = Math.max(1, ...report.memberTime.map((row) => row.totalHours));
  return <div className="grid gap-4 lg:grid-cols-2">
    {categories && <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("reports.categories")}</h2>{!report.byCategory.length ? <p className="text-sm text-muted">{t("reports.noData")}</p> : <div className="flex flex-col items-center gap-4 sm:flex-row"><svg viewBox="0 0 160 160" role="img" aria-label={t("reports.categories")} className="size-44 shrink-0"><circle cx="80" cy="80" r="60" fill="none" stroke="var(--color-border)" strokeWidth="20" />{report.byCategory.map((row, index) => {
      const length = row.count / report.events.count * circumference;
      const start = report.byCategory.slice(0, index).reduce((sum, category) => sum + category.count, 0) / report.events.count * circumference;
      return <circle key={row.category} cx="80" cy="80" r="60" fill="none" stroke={`var(--cat-${row.category.toLowerCase()}-dot)`} strokeWidth="20" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 80 80)"><title>{t("category." + row.category)}: {row.count}</title></circle>;
    })}<text x="80" y="86" textAnchor="middle" fill="var(--color-text)" fontSize="24" fontWeight="700">{report.events.count}</text></svg><ul className="flex min-w-0 flex-1 flex-col gap-2">{report.byCategory.map((row) => <li key={row.category} className="flex items-center gap-2 text-sm text-body"><span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: `var(--cat-${row.category.toLowerCase()}-dot)` }} /><span className="flex-1">{t("category." + row.category)}</span><span className="tabular-nums">{row.count} · {row.percent}%</span></li>)}</ul></div>}</Card>}
    {members && <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("reports.memberTime")}</h2>{!report.memberTime.length ? <p className="text-sm text-muted">{t("reports.noData")}</p> : <ul className="flex flex-col gap-4">{report.memberTime.map((row) => <li key={row.memberId}><div className="mb-2 flex justify-between gap-2 text-sm text-body"><span className="break-words">{row.displayName}</span><span className="shrink-0 tabular-nums">{t("reports.hours", { n: row.totalHours })}</span></div><div className="flex h-5 overflow-hidden rounded-control bg-border" aria-label={`${row.displayName}: ${row.totalHours}`} role="img">{Object.entries(row.hours).map(([category, hours]) => <span key={category} title={`${t("category." + category)}: ${hours}`} style={{ width: `${hours / max * 100}%`, background: `var(--cat-${category.toLowerCase()}-dot)` }} />)}</div><p className="mt-1 text-xs text-muted">{Object.entries(row.hours).map(([category, hours]) => `${t("category." + category)}: ${hours}`).join(" · ")}</p></li>)}</ul>}</Card>}
  </div>;
}
