import { api, clearApiSession } from "@/core/api/client";
import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import { newId } from "@/core/ids";
import { t } from "@/i18n/vi";
import { purgeSharedProjection } from "@/core/sync/purge";
import { setOnlineIdentity, type OnlineIdentity } from "@/core/db/online-identity";
export type { OnlineIdentity } from "@/core/db/online-identity";
export const SESSION_KEY = "online.identity";
export async function rememberSession(identity: OnlineIdentity) {
  const clean = { actorId: identity.actorId, deviceId: identity.deviceId, accountId: identity.accountId };
  const previous = (await db.settings.get(SESSION_KEY))?.value as OnlineIdentity | undefined;
  if (previous && previous.actorId !== clean.actorId) {
    for (const space of await db.spaces.where("sharingState").equals("SHARED").toArray()) await purgeSharedProjection(space.id, "IDENTITY_CHANGED");
  }
  setOnlineIdentity(clean);
  await db.settings.put({ key: SESSION_KEY, value: clean });
  await db.settings.put({ key: "online.enabled", value: true });
  clearApiSession();
}
export async function refreshSession(): Promise<OnlineIdentity> {
  const session = await api<OnlineIdentity>("GET", "/session");
  await rememberSession(session); return session;
}
export async function ensureLocalSession(): Promise<OnlineIdentity> {
  const local = await getLocalIdentity();
  try {
    const session = await refreshSession();
    if (session.actorId !== local.actorId) throw new Error(t("sharing.wrongIdentity"));
    return session;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || !["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(String(error.code))) throw error;
  }
  const cached = await db.settings.get(SESSION_KEY);
  if (cached) throw new Error(t("sharing.sessionMissing"));
  await api("POST", "/devices", { ...local, label: deviceLabel() });
  return refreshSession();
}
export function deviceLabel() {
  return typeof navigator === "undefined" ? "Browser" : /Mobile|Android|iPhone/i.test(navigator.userAgent) ? "Mobile browser" : "Desktop browser";
}
export function newOnlineDevice() { return { device_id: newId(), label: deviceLabel() }; }
export async function logout() {
  const pending = await db.outbox.filter((o) => o.state !== "ACKNOWLEDGED" && o.state !== "INVALID").count();
  if (pending) throw new Error(t("sharing.pendingLogout"));
  await db.settings.put({ key: "online.enabled", value: false });
  try { await api("POST", "/session/logout"); } catch (error) {
    await db.settings.put({ key: "online.enabled", value: true }); throw error;
  }
  const spaces = await db.spaces.where("sharingState").equals("SHARED").toArray();
  for (const space of spaces) await purgeSharedProjection(space.id);
  setOnlineIdentity(null);
  await db.settings.delete(SESSION_KEY);
  await db.settings.put({ key: "online.enabled", value: false });
  clearApiSession();
}
