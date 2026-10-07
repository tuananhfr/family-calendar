import { db, type NotificationRow } from "../db/db";
import { newId } from "../ids";

// modules.md §13; the same types are used by the server-side center once a Space is shared.
export const NOTIFICATION_TYPES = [
  "REMINDER_DUE",
  "INVITE",
  "JOIN_REQUEST",
  "SOS",
  "SYNC_CONFLICT",
  "BUDGET_ALERT",
  "AUTOMATION",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NewLocalNotification {
  spaceId: string | null;
  type: NotificationType;
  resourceRef?: { type: string; id: string } | null;
  /** Must already be safe (safeNotificationText for reminders); stored and shown as-is. */
  titleSafe: string;
  createdAt?: string;
}

export async function addLocalNotification(n: NewLocalNotification): Promise<string> {
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(n.type)) throw new RangeError(`Unknown notification type: ${n.type}`);
  if (!n.titleSafe.trim()) throw new RangeError("Notification text is required");
  const row: NotificationRow = {
    id: newId(),
    spaceId: n.spaceId,
    type: n.type,
    resourceRef: n.resourceRef ?? null,
    titleSafe: n.titleSafe,
    createdAt: n.createdAt ?? new Date().toISOString(),
    readAt: null,
  };
  await db.notifications.add(row);
  return row.id;
}

/** Newest first; with `spaceId`, that Space plus app-wide (null) notifications. */
export async function listNotifications(opts: { spaceId?: string; limit?: number } = {}): Promise<NotificationRow[]> {
  let rows = await db.notifications.orderBy("createdAt").reverse().toArray();
  if (opts.spaceId !== undefined) rows = rows.filter((r) => r.spaceId === opts.spaceId || r.spaceId === null);
  return opts.limit !== undefined ? rows.slice(0, opts.limit) : rows;
}

export async function unreadCount(spaceId?: string): Promise<number> {
  return db.notifications.filter((r) => r.readAt === null && (spaceId === undefined || r.spaceId === spaceId || r.spaceId === null)).count();
}

export async function markRead(id: string, at: Date = new Date()): Promise<void> {
  await db.transaction("rw", db.notifications, async () => {
    const row = await db.notifications.get(id);
    if (row && row.readAt === null) await db.notifications.update(id, { readAt: at.toISOString() });
  });
}

export async function markAllRead(at: Date = new Date()): Promise<void> {
  await db.notifications.filter((r) => r.readAt === null).modify({ readAt: at.toISOString() });
}
