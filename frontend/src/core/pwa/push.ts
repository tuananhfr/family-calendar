import { api } from "../api/client";
import { db } from "../db/db";
import { currentOnlineIdentity } from "../db/online-identity";
import { t } from "@/i18n/vi";
import { registerServiceWorker } from "./register";

interface SubscriptionInfo { id: string; device_id: string; current_device: boolean; }

export class PushSetupError extends Error {}

export function vapidBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const decoded = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function requireSharedDevice() {
  const enabled = (await db.settings.get("online.enabled"))?.value === true;
  if (!enabled || !currentOnlineIdentity() || !(await db.spaces.where("sharingState").equals("SHARED").count())) throw new PushSetupError(t("pwa.needsSharing"));
}

export async function subscribePush(): Promise<void> {
  await requireSharedDevice();
  const registration = await registerServiceWorker();
  if (!registration || !("PushManager" in globalThis)) throw new PushSetupError(t("pwa.unsupported"));
  if (Notification.permission !== "granted") throw new PushSetupError(t("pwa.permissionNeeded"));
  const meta = await api<{ vapid_public_key: string | null; channels: { push: boolean } }>("GET", "/meta");
  if (!meta.channels.push || !meta.vapid_public_key) throw new PushSetupError(t("pwa.notConfigured"));
  if (!registration.active) await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(meta.vapid_public_key) });
  const value = subscription.toJSON();
  try {
    await api("POST", "/push-subscriptions", { endpoint: value.endpoint, keys: value.keys, show_details: false });
  } catch (error) {
    if (!existing) await subscription.unsubscribe();
    throw error;
  }
}

export async function unsubscribePush(): Promise<void> {
  await requireSharedDevice();
  const registration = await registerServiceWorker();
  const subscription = await registration?.pushManager.getSubscription();
  const response = await api<{ subscriptions: SubscriptionInfo[] }>("GET", "/push-subscriptions");
  for (const row of response.subscriptions.filter((row) => row.current_device)) await api("DELETE", "/push-subscriptions/" + row.id);
  await subscription?.unsubscribe();
}

export async function hasPushSubscription(): Promise<boolean> {
  const registration = await registerServiceWorker();
  return !!registration && "PushManager" in globalThis && !!await registration.pushManager.getSubscription();
}
