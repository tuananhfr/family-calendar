"use client";

import { useEffect } from "react";
import { db } from "@/core/db/db";
import { GENERIC_BODY } from "@/core/notifications/safe-text";
import { startForegroundScanner, triggerId } from "@/core/notifications/foreground-scanner";
import { showSystemNotification } from "@/core/platform/notification-permission";
import { instantToZoned, timePart } from "@/core/time/zoned";
import { ROUTES } from "@/app-shell/nav-config";
import { playVoiceNote } from "@/features/items";
import { useReminderAlerts } from "../store/reminder-alerts";
import { ReminderToast } from "./ReminderToast";

const LATE_AFTER_MS = 5 * 60_000;

/**
 * Foreground reminders (LOCAL_ONLY, app open): the scanner records each trigger once in IndexedDB, so a reload or a
 * second tab never fires it again. Nothing here talks to the server (LOC-001).
 */
export function ReminderHost() {
  useEffect(
    () =>
      startForegroundScanner({
        // A failing scan must be visible to whoever debugs "reminders never ring"; the loop itself keeps going.
        onError: (error) => console.error("Reminder scan failed", error),
        onFire: (trigger, text) => {
          void (async () => {
            const item = await db.items.get(trigger.itemId);
            // Generic text means sensitive or details hidden: never offer that voice note aloud.
            const audioAssetId = text.body !== GENERIC_BODY ? item?.audioAssetId : undefined;
            const id = triggerId(trigger);
            // Saying "đến giờ" for a 07:30 reminder shown at 10:38 would claim a punctuality the app never had.
            const late = Date.now() - trigger.fireAt.getTime() > LATE_AFTER_MS && item;
            const lateSince = late ? (timePart(instantToZoned(trigger.fireAt, item.schedule.timeZone)) ?? undefined) : undefined;
            useReminderAlerts.getState().push({ id, itemId: trigger.itemId, occurrenceKey: trigger.occurrenceKey, title: text.title, body: text.body, audioAssetId, lateSince });
            // The in-app alert is enough while the user is looking at this tab; otherwise ask the OS too.
            if (!document.hasFocus()) void showSystemNotification(text, { tag: id, url: ROUTES.notifications });
            // Autoplay may be refused without a gesture; the alert keeps its own play button for that case.
            if (audioAssetId) void playVoiceNote(audioAssetId);
          })();
        },
      }),
    [],
  );
  return <ReminderToast />;
}
