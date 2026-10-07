"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, Check, Play, SkipForward, X } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { cn } from "@/design/cn";
import { Button, IconButton, toast } from "@/design/components";
import { actOnOccurrence, DEFAULT_SNOOZE_MINUTES, playVoiceNote, useItemEditor, type OccurrenceAction } from "@/features/items";
import { t } from "@/i18n/vi";
import { markOccurrenceRead } from "../model/notification-actions";
import { useReminderAlerts, type ReminderAlert } from "../store/reminder-alerts";

// Phones get one card so the alert never hides the whole screen; the rest wait behind "+n".
const VISIBLE_PHONE = 1;
const VISIBLE_DESKTOP = 2;
const DONE_TOAST: Record<Exclude<OccurrenceAction, "UNDO">, string> = { DONE: "doneToast", SNOOZE: "snoozedToast", SKIP: "skippedToast" };

function AlertCard({ alert, className }: { alert: ReminderAlert; className?: string }) {
  const dismiss = useReminderAlerts((s) => s.dismiss);
  const openDetail = useItemEditor((s) => s.openDetail);
  const [busy, setBusy] = useState<OccurrenceAction | null>(null);

  const act = async (action: Exclude<OccurrenceAction, "UNDO">) => {
    setBusy(action);
    try {
      await actOnOccurrence(alert.itemId, alert.occurrenceKey, action, DEFAULT_SNOOZE_MINUTES);
      await markOccurrenceRead(alert.occurrenceKey);
      dismiss(alert.id);
      toast(t(`notifications.alert.${DONE_TOAST[action]}`, { n: DEFAULT_SNOOZE_MINUTES }), "success");
    } catch {
      toast(t("notifications.alert.failed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const open = () => {
    void markOccurrenceRead(alert.occurrenceKey);
    dismiss(alert.id);
    openDetail(alert.itemId, alert.occurrenceKey);
  };

  const play = async () => {
    const result = await playVoiceNote(alert.audioAssetId!);
    if (result === "missing") toast(t("audio.missing"), "error");
  };

  return (
    <div role="alert" aria-label={t("notifications.alert.due")} data-testid="reminder-alert" className={cn("pointer-events-auto w-full flex-col gap-3 rounded-card border border-primary/30 bg-surface p-4 shadow-pop", className ?? "flex")}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <BellRing className="size-5" />
        </span>
        <button type="button" onClick={open} className="flex min-w-0 flex-1 flex-col items-start text-left">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">{alert.lateSince ? t("notifications.alert.late", { time: alert.lateSince }) : t("notifications.alert.due")}</span>
          <span className="break-words text-base font-bold text-text">{alert.body}</span>
        </button>
        <IconButton label={t("notifications.alert.close")} icon={<X className="size-4" />} onClick={() => dismiss(alert.id)} className="-mr-2 -mt-2" />
      </div>
      {alert.audioAssetId ? (
        <Button variant="secondary" size="sm" icon={<Play className="size-4" />} onClick={() => void play()} className="self-start">
          {t("notifications.alert.play")}
        </Button>
      ) : null}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        <Button size="sm" icon={<Check className="size-4" />} onClick={() => void act("DONE")} loading={busy === "DONE"} disabled={busy !== null}>
          {t("notifications.alert.done")}
        </Button>
        <Button variant="secondary" size="sm" icon={<BellRing className="size-4" />} onClick={() => void act("SNOOZE")} loading={busy === "SNOOZE"} disabled={busy !== null} aria-label={t("notifications.alert.snooze", { n: DEFAULT_SNOOZE_MINUTES })}>
          {t("notifications.alert.snoozeShort")}
        </Button>
        <Button variant="ghost" size="sm" icon={<SkipForward className="size-4" />} onClick={() => void act("SKIP")} loading={busy === "SKIP"} disabled={busy !== null}>
          {t("notifications.alert.skip")}
        </Button>
      </div>
    </div>
  );
}

/** Due reminders of this tab, under the header so they never cover the bottom nav or the "Thêm mới" button. */
export function ReminderToast() {
  const alerts = useReminderAlerts((s) => s.alerts);
  if (alerts.length === 0) return null;
  const shown = alerts.slice(-VISIBLE_DESKTOP).reverse();
  const hiddenPhone = alerts.length - VISIBLE_PHONE;
  const hiddenDesktop = alerts.length - shown.length;
  const more = (n: number, className: string) =>
    n > 0 ? (
      <Link href={ROUTES.notifications} className={cn("pointer-events-auto self-end rounded-chip bg-surface px-3 py-1 text-sm font-semibold text-primary shadow-pop", className)}>
        {t("notifications.alert.more", { n })}
      </Link>
    ) : null;
  return (
    <section aria-label={t("notifications.alert.region")} className="pointer-events-none fixed inset-x-3 top-[72px] z-40 flex flex-col gap-2 md:inset-x-auto md:right-6 md:top-[88px] md:w-[380px]">
      {shown.map((a, i) => (
        <AlertCard key={a.id} alert={a} className={i < VISIBLE_PHONE ? undefined : "hidden md:flex"} />
      ))}
      {more(hiddenPhone, "md:hidden")}
      {more(hiddenDesktop, "hidden md:block")}
    </section>
  );
}
