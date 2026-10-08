"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { buttonClass } from "@/design/components";
import { t } from "@/i18n/vi";
import type { TodayHeader } from "../model/greeting";
import { longDateVi } from "../model/date-label";

export function Greeting({ header }: { header: TodayHeader }) {
  return (
    <section aria-labelledby="today-title" className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">{header.greeting}</p>
        <h1 id="today-title" className="mt-1.5 text-2xl font-bold leading-tight tracking-tight text-text md:text-[1.875rem]">{t("today.title")}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted md:text-sm">
          <span>{longDateVi(header.today)}</span><span aria-hidden>&middot;</span><span>{header.lunarLabel}</span>
        </p>
        {header.timeZoneNote ? <p className="mt-2 text-xs font-medium text-primary" data-testid="tz-note">{header.timeZoneNote}</p> : null}
      </div>
      <Link href={`${ROUTES.calendar}?view=week&date=${header.today}`} className={buttonClass("secondary", "md")}>
        <CalendarDays aria-hidden className="size-4" />{t("today.viewWeek")}
      </Link>
    </section>
  );
}
