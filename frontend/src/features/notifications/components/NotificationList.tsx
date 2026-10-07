"use client";

import { Bell, BellRing, Info, Mail, RefreshCw, ShieldAlert, Users, Wallet, Zap, type LucideIcon } from "lucide-react";
import type { NotificationRow } from "@/core/db/db";
import { markRead } from "@/core/notifications/local-center";
import { parseOccurrenceKey } from "@/core/recurrence/occurrence-key";
import { datePart, instantToZoned, timePart } from "@/core/time/zoned";
import { cn } from "@/design/cn";
import { formatDateVi, useItemEditor } from "@/features/items";
import { t } from "@/i18n/vi";
import { occurrenceOf, type NotificationGroup } from "../model/notification-groups";

const TYPE_ICON: Record<string, LucideIcon> = {
  REMINDER_DUE: BellRing,
  INVITE: Mail,
  JOIN_REQUEST: Users,
  SOS: ShieldAlert,
  SYNC_CONFLICT: RefreshCw,
  BUDGET_ALERT: Wallet,
  AUTOMATION: Zap,
  SYSTEM: Info,
};
const TYPE_TONE: Record<string, string> = {
  SOS: "bg-danger-soft text-danger",
  SYNC_CONFLICT: "bg-warning-soft text-warning",
  BUDGET_ALERT: "bg-warning-soft text-warning",
};

function whenLabel(row: NotificationRow, group: NotificationGroup["key"], timeZone: string): string {
  const local = instantToZoned(new Date(row.createdAt), timeZone);
  const time = timePart(local) ?? "";
  return group === "earlier" ? `${formatDateVi(datePart(local))} · ${time}` : time;
}

function Row({ row, group, timeZone }: { row: NotificationRow; group: NotificationGroup["key"]; timeZone: string }) {
  const openDetail = useItemEditor((s) => s.openDetail);
  const Icon = TYPE_ICON[row.type] ?? Bell;
  const key = occurrenceOf(row);
  const unread = row.readAt === null;
  const open = () => {
    if (unread) void markRead(row.id);
    const parsed = key ? parseOccurrenceKey(key) : null;
    if (parsed && key) openDetail(parsed.itemId, key);
  };
  const typeLabel = t(`notifications.types.${row.type}`);
  return (
    <li>
      <button
        type="button"
        onClick={open}
        data-testid="notification-row"
        data-unread={unread || undefined}
        className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-soft/60 md:px-5", unread && "bg-primary-soft/40")}
      >
        <span aria-hidden className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full", TYPE_TONE[row.type] ?? "bg-primary-soft text-primary")}>
          <Icon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("break-words text-sm text-text", unread ? "font-bold" : "font-medium")}>{row.titleSafe}</span>
          <span className="text-xs text-muted">
            {typeLabel} · <span className="tabular-nums">{whenLabel(row, group, timeZone)}</span>
          </span>
        </span>
        {unread ? (
          <span className="mt-1.5 flex shrink-0 items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-primary" />
            <span className="sr-only">{t("notifications.unread")}</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function NotificationList({ groups, timeZone }: { groups: NotificationGroup[]; timeZone: string }) {
  return (
    <div className="flex flex-col">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`notif-${g.key}`} className="border-b border-border last:border-b-0">
          <h2 id={`notif-${g.key}`} className="px-4 pb-1 pt-4 text-xs font-bold uppercase tracking-wide text-muted md:px-5">
            {t(`notifications.groups.${g.key}`)}
          </h2>
          <ul className="flex flex-col divide-y divide-border">
            {g.rows.map((row) => (
              <Row key={row.id} row={row} group={g.key} timeZone={timeZone} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

