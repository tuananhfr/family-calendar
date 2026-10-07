"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isLocalDate, type LocalDate } from "@/core/time/local-date";
import { useSpaceToday } from "@/features/members";

export const CALENDAR_VIEWS = ["day", "week", "month"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

function isView(v: string | null): v is CalendarView {
  return v !== null && (CALENDAR_VIEWS as readonly string[]).includes(v);
}

type CalendarPlace = { view: CalendarView; date: LocalDate };
type CalendarUpdate = Partial<CalendarPlace> | ((current: CalendarPlace) => Partial<CalendarPlace>);

/** View and anchor date live in the URL (?view=&date=) so refresh, back and shared links land on the same place. */
export function useCalendarParams(): { view: CalendarView; date: LocalDate; today: LocalDate; set: (next: CalendarUpdate) => void } {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = useSpaceToday();
  const rawView = params.get("view");
  const rawDate = params.get("date");
  // UX-003: week is the default, month is a secondary view.
  const view: CalendarView = isView(rawView) ? rawView : "week";
  const date = rawDate && isLocalDate(rawDate) ? rawDate : today;

  // router.replace lands a moment later; two quick "Tuần trước" clicks must both step from the newest place.
  const requested = useRef<CalendarPlace | null>(null);
  useEffect(() => {
    requested.current = null;
  }, [view, date]);

  const set = useCallback(
    (update: CalendarUpdate) => {
      const current = requested.current ?? { view, date };
      const next = { ...current, ...(typeof update === "function" ? update(current) : update) };
      requested.current = next;
      const q = new URLSearchParams(params.toString());
      q.set("view", next.view);
      q.set("date", next.date);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [params, router, pathname, view, date],
  );
  return { view, date, today, set };
}
