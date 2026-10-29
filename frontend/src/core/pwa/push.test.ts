import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/db";
import { setOnlineIdentity } from "../db/online-identity";
import { getLocalIdentity } from "../db/local-identity";
import { createLocalSpace } from "../repo/write";
import { subscribePush, unsubscribePush, vapidBytes } from "./push";

const mocks = vi.hoisted(() => ({ api: vi.fn(), registration: vi.fn() }));
vi.mock("../api/client", () => ({ api: mocks.api }));
vi.mock("./register", () => ({ registerServiceWorker: mocks.registration }));
beforeEach(async () => {
  await db.delete(); await db.open(); setOnlineIdentity(null); mocks.api.mockReset(); mocks.registration.mockReset();
  vi.stubGlobal("PushManager", class {}); vi.stubGlobal("Notification", { permission: "granted" });
});
afterEach(() => vi.unstubAllGlobals());
async function shared() {
  const identity = await getLocalIdentity(); setOnlineIdentity({ ...identity, accountId: null });
  const id = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" }); await db.spaces.update(id, { sharingState: "SHARED" });
  await db.settings.put({ key: "online.enabled", value: true });
}
const subscription = () => ({ toJSON: () => ({ endpoint: "https://push.example.test/device", keys: { p256dh: "public-key", auth: "auth-key" } }), unsubscribe: vi.fn(async () => true) });

describe("push enrollment", () => {
  it("makes no API request without shared opt-in", async () => {
    await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    await expect(subscribePush()).rejects.toThrow(); expect(mocks.api).not.toHaveBeenCalled(); expect(mocks.registration).not.toHaveBeenCalled();
  });
  it("requires granted permission and configured VAPID before creating a subscription", async () => {
    await shared(); const subscribe = vi.fn(); mocks.registration.mockResolvedValue({ active: {}, pushManager: { subscribe } });
    vi.stubGlobal("Notification", { permission: "denied" }); await expect(subscribePush()).rejects.toThrow(); expect(mocks.api).not.toHaveBeenCalled();
    vi.stubGlobal("Notification", { permission: "granted" }); mocks.api.mockResolvedValue({ vapid_public_key: null, channels: { push: false } });
    await expect(subscribePush()).rejects.toThrow(); expect(subscribe).not.toHaveBeenCalled();
  });
  it("enrolls a real device reference with details hidden and rolls back a new browser subscription on failure", async () => {
    await shared(); const sub = subscription();
    mocks.registration.mockResolvedValue({ active: {}, pushManager: { getSubscription: async () => null, subscribe: async () => sub } });
    mocks.api.mockResolvedValueOnce({ vapid_public_key: "AQID", channels: { push: true } }).mockRejectedValueOnce(new Error("server refused"));
    await expect(subscribePush()).rejects.toThrow("server refused");
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mocks.api).toHaveBeenLastCalledWith("POST", "/push-subscriptions", { ...sub.toJSON(), show_details: false });
  });
  it("does not delete an existing browser subscription if reenrollment fails", async () => {
    await shared(); const sub = subscription();
    mocks.registration.mockResolvedValue({ active: {}, pushManager: { getSubscription: async () => sub } });
    mocks.api.mockResolvedValueOnce({ vapid_public_key: "AQID", channels: { push: true } }).mockRejectedValueOnce(new Error("offline"));
    await expect(subscribePush()).rejects.toThrow(); expect(sub.unsubscribe).not.toHaveBeenCalled();
  });
  it("unsubscribes only server rows belonging to the current device", async () => {
    await shared(); const sub = subscription(); mocks.registration.mockResolvedValue({ pushManager: { getSubscription: async () => sub } });
    mocks.api.mockResolvedValueOnce({ subscriptions: [{ id: "mine", current_device: true }, { id: "other", current_device: false }] }).mockResolvedValueOnce(undefined);
    await unsubscribePush();
    expect(mocks.api.mock.calls).toEqual([["GET", "/push-subscriptions"], ["DELETE", "/push-subscriptions/mine"]]);
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it("decodes URL-safe VAPID bytes", () => expect([...vapidBytes("AQID")]).toEqual([1, 2, 3]));
});
