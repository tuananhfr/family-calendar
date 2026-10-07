"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { NotificationRow } from "@/core/db/db";
import { listNotifications, unreadCount } from "@/core/notifications/local-center";

/** The active Space's notifications plus app-wide ones, newest first. */
export function useNotifications(spaceId: string | undefined): { loading: boolean; rows: NotificationRow[] } {
  const rows = useLiveQuery(() => (spaceId ? listNotifications({ spaceId }) : []), [spaceId]);
  return { loading: rows === undefined, rows: rows ?? [] };
}

export function useUnreadCount(spaceId: string | undefined): number {
  return useLiveQuery(() => (spaceId ? unreadCount(spaceId) : 0), [spaceId]) ?? 0;
}
