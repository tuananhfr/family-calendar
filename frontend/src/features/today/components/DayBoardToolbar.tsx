"use client";

import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { CalendarPlus, ChevronLeft, ChevronRight, Ellipsis, ExternalLink, Filter, Plus, UserPlus } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { formatLunar, solarToLunar } from "@/core/lunar/lunar";
import type { Member } from "@/core/model/member";
import { addDays, type LocalDate } from "@/core/time/local-date";
import { buttonClass, IconButton } from "@/design/components";
import { cn } from "@/design/cn";
import { MemberAvatar, MemberChips } from "@/features/members";
import { t } from "@/i18n/vi";
import { boardDateVi } from "../model/date-label";

function ViewSwitch({ date }: { date: LocalDate }) {
  const link = (view: string) => `${ROUTES.calendar}?view=${view}&date=${date}`;
  const item = "inline-flex min-h-11 items-center justify-center rounded-[8px] px-2 text-xs font-semibold lg:min-h-9";
  return (
    <nav aria-label={t("today.board.label")} className="inline-flex shrink-0 rounded-control bg-primary-soft p-1">
      <span aria-current="page" className={cn(item, "bg-primary text-on-primary")}>
        {t("today.board.views.day")}
      </span>
      <Link href={link("week")} className={cn(item, "text-primary hover:bg-surface")}>
        {t("today.board.views.week")}
      </Link>
      <Link href={link("month")} className={cn(item, "text-primary hover:bg-surface")}>
        {t("today.board.views.month")}
      </Link>
    </nav>
  );
}

/** "Thêm cột": brings back a member hidden by the filter; with everyone shown it points to adding a member. */
function AddColumn({ hidden, onAdd }: { hidden: Member[]; onAdd: (id: string) => void }) {
  return (
    <Menu.Sub>
      <Menu.SubTrigger className="flex min-h-11 cursor-default items-center gap-2 rounded-[8px] px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft">
        <Plus aria-hidden className="size-4" />
        {t("today.board.addColumn")}
      </Menu.SubTrigger>
      <Menu.Portal>
        <Menu.SubContent sideOffset={6} collisionPadding={12} className="z-50 min-w-56 rounded-control border border-border bg-surface p-1 shadow-pop">
          {hidden.map((m) => (
            <Menu.Item
              key={m.id}
              onSelect={() => onAdd(m.id)}
              className="flex min-h-11 cursor-default items-center gap-2 rounded-[8px] px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft"
            >
              <MemberAvatar name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="xs" />
              {m.displayName}
            </Menu.Item>
          ))}
          {hidden.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted">{t("today.board.noHiddenMembers")}</p> : null}
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item asChild>
            <Link href={ROUTES.addMember} className="flex min-h-11 items-center gap-2 rounded-[8px] px-2 text-sm text-primary outline-none data-[highlighted]:bg-primary-soft">
              <UserPlus aria-hidden className="size-4" />
              {t("today.board.addMember")}
            </Link>
          </Menu.Item>
        </Menu.SubContent>
      </Menu.Portal>
    </Menu.Sub>
  );
}

interface DayBoardToolbarProps {
  date: LocalDate;
  today: LocalDate;
  members: Member[];
  hidden: Member[];
  filter: string[] | "ALL";
  setFilter: (value: string[] | "ALL") => void;
  onDateChange: (date: LocalDate) => void;
  addColumn: (id: string) => void;
  addOnDate: () => void;
}

export function DayBoardToolbar({ date, today, members, hidden, filter, setFilter, onDateChange, addColumn, addOnDate }: DayBoardToolbarProps) {
  const isToday = date === today;
  const lunar = formatLunar(solarToLunar(date));
  return (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4 lg:flex lg:flex-wrap">
        <div className="order-3 lg:order-3"><ViewSwitch date={date} /></div>
        <div className="order-4 flex items-center justify-end gap-1 lg:order-1">
          <IconButton label={t("today.board.prevDay")} icon={<ChevronLeft className="size-5" />} variant="outline" className="lg:size-10" onClick={() => onDateChange(addDays(date, -1))} />
          <IconButton label={t("today.board.nextDay")} icon={<ChevronRight className="size-5" />} variant="outline" className="lg:size-10" onClick={() => onDateChange(addDays(date, 1))} />
        </div>
        <div className="order-1 min-w-0 lg:order-2 lg:flex-1">
          <h2 className="text-sm font-bold text-text md:text-base" aria-live="polite" data-testid="board-date">
            {boardDateVi(date)}
          </h2>
          <p className="sr-only">{lunar}</p>
        </div>
        <div className="order-2 flex items-center justify-end gap-1 lg:order-4">
          {!isToday ? (
            <button type="button" onClick={() => onDateChange(today)} className={cn(buttonClass("secondary", "md"), "lg:min-h-9 lg:px-2 lg:text-xs")}>
              {t("today.board.backToToday")}
            </button>
          ) : null}
          <div className="hidden lg:block [&>button]:px-0 @4xl:[&>button]:px-2">
          <Popover.Root>
            <Popover.Trigger aria-label={t("today.board.filter")} className={cn(buttonClass("secondary", "sm"), "size-9 px-0 @4xl:w-auto @4xl:px-2")}>
              <Filter aria-hidden className="size-4" />
              <span className="sr-only @4xl:not-sr-only">{t("today.board.filter")}</span>
              {filter !== "ALL" ? <span className="rounded-chip bg-primary px-1.5 text-xs text-on-primary">{filter.length}</span> : null}
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={6} className="z-50 w-[min(26rem,calc(100vw-2rem))] rounded-control border border-border bg-surface p-3 shadow-pop [&>div]:flex-wrap [&>div]:overflow-visible [&_button]:h-11">
                <MemberChips members={members} value={filter} onChange={setFilter} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          </div>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton label={t("today.board.more")} icon={<Ellipsis className="size-5" />} variant="outline" className="lg:size-10" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-control border border-border bg-surface p-1 shadow-pop">
                <Menu.Item onSelect={addOnDate} className="flex min-h-11 cursor-default items-center gap-2 rounded-[8px] px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft">
                  <CalendarPlus aria-hidden className="size-4 text-primary" />
                  {t("today.board.addEvent")}
                </Menu.Item>
                <Menu.Item asChild>
                  <Link
                    href={`${ROUTES.calendar}?view=day&date=${date}`}
                    className="flex min-h-11 items-center gap-2 rounded-[8px] px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft"
                  >
                    <ExternalLink aria-hidden className="size-4 text-primary" />
                    {t("today.board.openCalendar")}
                  </Link>
                </Menu.Item>
                <Menu.Separator className="my-1 h-px bg-border" />
                <AddColumn hidden={hidden} onAdd={addColumn} />
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>
  );
}
