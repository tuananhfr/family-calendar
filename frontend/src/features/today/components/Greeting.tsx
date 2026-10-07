"use client";

import { Sun } from "lucide-react";
import { Illustration, ScriptText } from "@/design/components";
import { t } from "@/i18n/vi";
import type { TodayHeader } from "../model/greeting";
import { longDateVi } from "../model/date-label";

/** IMG-A hero: greeting by Space-local time, solar + lunar date, and a note when the device runs in another zone. */
export function Greeting({ header }: { header: TodayHeader }) {
  return (
    <section aria-labelledby="today-title" className="flex items-center justify-between gap-4 overflow-hidden">
      <div className="flex min-w-0 flex-1 items-start gap-3 py-1 md:gap-4 md:py-4">
        <Sun aria-hidden className="mt-1 size-9 shrink-0 text-warning md:size-12" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-lg font-medium text-primary md:text-xl">{header.greeting}</p>
          <h1 id="today-title" className="text-2xl font-extrabold leading-tight tracking-tight text-text md:text-[2rem]">
            {t("today.title")}
          </h1>
          <p className="mt-1.5 text-base font-bold text-text">
            {longDateVi(header.today)}
            <span className="ml-2 text-sm font-medium text-muted">{header.lunarLabel}</span>
          </p>
          <p className="mt-0.5 text-sm text-body">{t("today.subtitle")}</p>
          {header.timeZoneNote ? (
            <p className="mt-2 inline-flex rounded-chip bg-info-soft px-2.5 py-1 text-xs font-semibold text-text" data-testid="tz-note">
              {header.timeZoneNote}
            </p>
          ) : null}
        </div>
      </div>
      <div className="hidden shrink-0 items-start gap-3 md:flex">
        <Illustration name="hero-today" height={140} priority className="2xl:hidden" />
        <Illustration name="hero-today" height={190} priority className="hidden 2xl:block" />
        {/* Wrapped because ScriptText sets its own display and cn() does not merge conflicting classes. */}
        <div className="mt-2 hidden max-w-[12rem] -rotate-6 2xl:block">
          <ScriptText className="text-base">{t("today.scriptRight")}</ScriptText>
        </div>
      </div>
    </section>
  );
}
