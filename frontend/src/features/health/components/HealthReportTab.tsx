import Link from "next/link";
import { Printer, ShieldAlert } from "lucide-react";
import type { Member } from "@/core/model/member";
import { buttonClass, Card } from "@/design/components";
import { MemberAvatar } from "@/features/members";
import { t } from "@/i18n/vi";

export const healthPrintHref = (memberId: string) => `/in/suc-khoe/?tv=${memberId}`;

/** "Báo cáo": one printable/PDF page per member, behind a sensitive-data warning (modules.md §8). */
export function HealthReportTab({ members }: { members: Member[] }) {
  return (
    <div className="flex flex-col gap-4">
      <p role="note" className="flex items-start gap-2 rounded-card border border-warning/40 bg-warning-soft px-4 py-3 text-sm font-medium text-text" data-testid="health-report-warning">
        <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
        {t("health.report.warning")}
      </p>
      <Card className="flex min-w-0 flex-col gap-2">
        <h2 className="text-base font-bold text-text">{t("health.report.title")}</h2>
        <p className="text-sm text-body">{t("health.report.intro")}</p>
        <ul className="flex flex-col divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <MemberAvatar name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{m.displayName}</span>
              <Link href={healthPrintHref(m.id)} className={buttonClass("secondary", "sm")} aria-label={t("health.report.printFor", { name: m.displayName })}>
                <Printer aria-hidden className="size-4" />
                {t("health.report.print")}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
