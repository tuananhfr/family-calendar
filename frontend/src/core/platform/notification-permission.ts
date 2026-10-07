import { withBase } from "../config";
import { db } from "../db/db";
import { GENERIC_TITLE } from "../notifications/safe-text";
import type { NotificationCapability } from "./capabilities";

const ASKED_KEY = "notifications.permissionAskedAt";

interface NotificationApi {
  permission: string;
  requestPermission(): Promise<string>;
  new (title: string, options?: NotificationOptions): unknown;
}

function api(): NotificationApi | undefined {
  return (globalThis as { Notification?: NotificationApi }).Notification;
}

export function notificationPermission(): NotificationCapability {
  const p = api()?.permission;
  return p === "default" || p === "granted" || p === "denied" ? p : "unsupported";
}

export async function hasAskedForPermission(): Promise<boolean> {
  return (await db.settings.get(ASKED_KEY)) !== undefined;
}

/**
 * Must be called from a user gesture (the "Bật thông báo" button). The browser prompt is shown at most once from
 * the app; later the user changes it in browser settings — re-prompting on load is what gets sites blocked.
 */
export async function requestNotificationPermission(now: Date = new Date()): Promise<NotificationCapability> {
  const Notification = api();
  if (!Notification) return "unsupported";
  if (Notification.permission !== "default") return notificationPermission();
  await db.settings.put({ key: ASKED_KEY, value: now.toISOString() });
  const result = await Notification.requestPermission();
  return result === "granted" || result === "denied" ? result : "default";
}

/**
 * Shows an OS notification. The text must already come from safeNotificationText(). Prefers the service worker
 * (Android Chrome rejects `new Notification()` in a page) and returns false when nothing could be shown.
 */
export async function showSystemNotification(text: { title?: string; body: string }, opts: { tag?: string; url?: string } = {}): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const options: NotificationOptions = { body: text.body, tag: opts.tag, data: { url: withBase(opts.url ?? "/") }, icon: withBase("/icons/icon-192.png") };
  const title = text.title ?? GENERIC_TITLE;
  try {
    const sw = (globalThis.navigator as Navigator | undefined)?.serviceWorker;
    const reg = sw ? await sw.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    const Notification = api();
    if (!Notification) return false;
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
