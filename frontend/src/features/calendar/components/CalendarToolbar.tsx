"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Member } from "@/core/model/member";
import { buttonClass, IconButton } from "@/design/components";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import { CALENDAR_VIEWS, type CalendarView } from "../hooks/useCalendarParams";
import { CalendarFilters } from "./CalendarFilters";

/** IMG-D toolbar: Hôm nay ‹ › title · Lọc · Ngày/Tuần/Tháng. */
export function CalendarToolbar({
  view,
  title,
  subtitle,
  isCurrent,
  members,
  onToday,
  onStep,
  onView,
}: {
  view: CalendarView;
  title: string;
  subtitle?: string;
  isCurrent: boolean;
  members: Member[];
  onToday: () => void;
  onStep: (delta: 1 | -1) => void;
  onView: (v: CalendarView) => void;
}) {
  return (
    <div className="@container flex flex-wrap items-center gap-2 border-b border-border p-3 md:p-4">
      <button type="button" onClick={onToday} disabled={isCurrent} className={cn(buttonClass("secondary", "sm"), "disabled:border-border-strong disabled:bg-surface disabled:text-text")}>
        {t("calendar.today")}
      </button>
      <IconButton label={t(`calendar.prev.${view}`)} icon={<ChevronLeft className="size-5" />} variant="outline" onClick={() => onStep(-1)} />
      <IconButton label={t(`calendar.next.${view}`)} icon={<ChevronRight className="size-5" />} variant="outline" onClick={() => onStep(1)} />
      {/* Phones get the title on its own line; beside the buttons it truncates to "Th…". */}
      <div className="order-first min-w-0 basis-full px-1 @xl:order-none @xl:basis-auto @xl:flex-1">
        <h2 className="truncate text-base font-bold text-text md:text-lg" aria-live="polite" data-testid="calendar-title">
          {title}
        </h2>
        {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
      </div>
      {/* Wrapped: cn() does not merge, so "hidden" on the trigger would lose to its own inline-flex. Phones use the chip row. */}
      <div className="hidden md:block">
        <CalendarFilters members={members} />
      </div>
      <div role="group" aria-label={t("calendar.viewLabel")} className="ml-auto inline-flex rounded-control bg-primary-soft p-1 @xl:ml-0">
        {CALENDAR_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => onView(v)}
            className={cn("inline-flex min-h-9 items-center rounded-[8px] px-3 text-sm font-semibold", view === v ? "bg-primary text-on-primary" : "text-primary hover:bg-surface")}
          >
            {t(`calendar.views.${v}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
