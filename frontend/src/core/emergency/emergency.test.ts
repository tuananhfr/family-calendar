import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/db";
import { getLocalIdentity } from "../db/local-identity";
import { setOnlineIdentity } from "../db/online-identity";
import { accessContextFor } from "../access/evaluate";
import { createLocalSpace } from "../repo/write";
import { ApiRequestError } from "../api/errors";
import { closeEmergency, createEmergency, saveEmergencyPosition } from "./persist";
import { flushEmergencyQueue, purgeExpiredEmergencyPositions } from "./queue";
import { locationLabel, type EmergencyRecord, type EmergencyPosition } from "./model";
import { dialerUrl, normalizedPhone } from "./contacts";
import { purgeSharedProjection } from "../sync/purge";
import { emergencyContactSchema, emergencyRecordSchema } from "./schema";
import { retryEmergencyDelivery } from "./retry";

const request = vi.hoisted(() => vi.fn());
vi.mock("../api/client", async (original) => ({ ...await original<typeof import("../api/client")>(), api: request }));
beforeEach(async () => { await db.delete(); await db.open(); setOnlineIdentity(null); request.mockReset(); });

async function setup(shared = true) {
  const identity = await getLocalIdentity();
  const spaceId = await createLocalSpace({ name: "Nhà mình", kind: "FAMILY" });
  const space = (await db.spaces.get(spaceId))!;
  if (shared) { space.sharingState = "SHARED"; await db.spaces.put(space); setOnlineIdentity({ ...identity, accountId: null }); await db.settings.put({ key: "online.enabled", value: true }); }
  const access = accessContextFor("OWNER", { actorId: identity.actorId, spaceKind: "FAMILY", representedMemberIds: [], representedProfiles: ["PARENT"] });
  return { space, access, identity };
}
const accepted = (event: EmergencyRecord) => ({ id: event.id, lifecycle: event.status, client_triggered_at: event.createdAt, server_received_at: "2026-10-13T01:00:00.000Z", closed_at: event.closedAt ?? null, revision: "1", delivery: "SERVER_ACCEPTED" });

describe("durable SOS", () => {
  it("allows an explicit retry after same-actor reauthentication but keeps forbidden and identity changes blocked", async () => {
    const { space, access, identity } = await setup(); const event = await createEmergency(space, access);
    request.mockRejectedValue(new ApiRequestError("SESSION_EXPIRED", 401)); await flushEmergencyQueue();
    await expect(retryEmergencyDelivery(event.id, access.actorId)).rejects.toThrow("AUTH_REQUIRED");
    await db.syncCursors.put({ spaceId: space.id, cursor: "0", updatedAt: new Date().toISOString(), access: { actorId: access.actorId } });
    await retryEmergencyDelivery(event.id, access.actorId); request.mockResolvedValue(accepted(event)); await flushEmergencyQueue();
    expect(await db.emergencyQueue.count()).toBe(0);
    await db.emergencyEvents.update(event.id, { delivery: "BLOCKED", errorCode: "FORBIDDEN" });
    await expect(retryEmergencyDelivery(event.id, access.actorId)).rejects.toThrow("FORBIDDEN");
    setOnlineIdentity({ ...identity, actorId: "bc7b0992-fdfb-49c5-801d-f8e0d66ecbce", accountId: null });
    await expect(retryEmergencyDelivery(event.id, access.actorId)).rejects.toThrow("FORBIDDEN");
  });
  it("purges revoked projections but keeps the user's unsent SOS as a blocked draft without GPS", async () => {
    const { space, access } = await setup();
    const event = await createEmergency(space, access);
    await saveEmergencyPosition(event.id, access.actorId, { lat: 10, lng: 106, accuracy: 15, capturedAt: new Date().toISOString(), provenance: "CURRENT" });
    await purgeSharedProjection(space.id);
    expect(await db.emergencyEvents.count()).toBe(0);
    expect(await db.emergencyQueue.count()).toBe(0);
    expect((await db.emergencyDrafts.get(event.id))?.event).toMatchObject({ id: event.id, delivery: "BLOCKED" });
    expect((await db.emergencyDrafts.get(event.id))?.event.position).toBeUndefined();
    await flushEmergencyQueue();
    expect(request).not.toHaveBeenCalled();
  });
  it("commits the event and operation before the first request", async () => {
    const { space, access } = await setup();
    const event = await createEmergency(space, access);
    expect(request).not.toHaveBeenCalled();
    request.mockImplementation(async () => { expect(await db.emergencyEvents.get(event.id)).toMatchObject({ status: "ACTIVE", createdAt: event.createdAt }); expect(await db.emergencyQueue.count()).toBe(1); return accepted(event); });
    await flushEmergencyQueue();
    expect(request).toHaveBeenCalledTimes(1);
    expect(await db.emergencyQueue.count()).toBe(0);
    expect(await db.emergencyEvents.get(event.id)).toMatchObject({ delivery: "SERVER_ACCEPTED" });
  });

  it("does not create a queue or send content for LOCAL_ONLY, even after sharing later", async () => {
    const { space, access, identity } = await setup(false);
    await createEmergency(space, access);
    await db.spaces.update(space.id, { sharingState: "SHARED" });
    setOnlineIdentity({ ...identity, accountId: null });
    await db.settings.put({ key: "online.enabled", value: true });
    await flushEmergencyQueue();
    expect(await db.emergencyQueue.count()).toBe(0);
    expect(request).not.toHaveBeenCalled();
  });

  it("rolls back both rows when queue storage fails, and sends nothing", async () => {
    const { space, access } = await setup();
    const add = vi.spyOn(db.emergencyQueue, "add").mockRejectedValueOnce(new DOMException("Full", "QuotaExceededError"));
    await expect(createEmergency(space, access)).rejects.toThrow();
    add.mockRestore();
    expect(await db.emergencyEvents.count()).toBe(0);
    await flushEmergencyQueue();
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps original time across reopen and reconciles the latest offline close", async () => {
    const { space, access } = await setup();
    const event = await createEmergency(space, access, new Date("2026-10-13T00:00:00Z"));
    await closeEmergency(event.id, "CLOSED_SAFE", access.actorId);
    db.close(); await db.open();
    const closed = await db.emergencyEvents.get(event.id) as EmergencyRecord;
    request.mockResolvedValue(accepted(closed));
    await flushEmergencyQueue();
    expect(request.mock.calls[0][2]).toMatchObject({ id: event.id, lifecycle: "CLOSED_SAFE", client_triggered_at: "2026-10-13T00:00:00.000Z" });
    expect(await db.emergencyQueue.count()).toBe(0);
  });

  it("retains the newer close operation when an older ACTIVE request finishes", async () => {
    const { space, access } = await setup();
    const event = await createEmergency(space, access);
    let resolve!: (value: unknown) => void;
    request.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const sending = flushEmergencyQueue();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await closeEmergency(event.id, "CLOSED_SAFE", access.actorId);
    resolve(accepted(event)); await sending;
    expect(await db.emergencyEvents.get(event.id)).toMatchObject({ status: "CLOSED_SAFE", delivery: "LOCAL_PENDING" });
    expect(await db.emergencyQueue.count()).toBe(1);
    request.mockResolvedValue(accepted(await db.emergencyEvents.get(event.id) as EmergencyRecord));
    await flushEmergencyQueue();
    expect(await db.emergencyQueue.count()).toBe(0);
  });

  it("serializes concurrent senders and keeps retryable and blocked states honest", async () => {
    const { space, access } = await setup();
    const event = await createEmergency(space, access);
    request.mockRejectedValue(new ApiRequestError("NETWORK", 0));
    await Promise.all([flushEmergencyQueue(), flushEmergencyQueue()]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(await db.emergencyEvents.get(event.id)).toMatchObject({ delivery: "FAILED_RETRYABLE" });
    request.mockRejectedValue(new ApiRequestError("SESSION_EXPIRED", 401));
    await flushEmergencyQueue(Date.now() + 10_000);
    expect(await db.emergencyEvents.get(event.id)).toMatchObject({ delivery: "BLOCKED" });
    expect((await db.emergencyQueue.toArray())[0].blocked).toBe(true);
  });

  it("coalesces double trigger and enforces creator-only terminal transitions", async () => {
    const { space, access } = await setup();
    const events = await Promise.all([createEmergency(space, access), createEmergency(space, access)]);
    expect(events[0].id).toBe(events[1].id);
    await expect(closeEmergency(events[0].id, "CLOSED_SAFE", "another-actor")).rejects.toThrow("FORBIDDEN");
    await closeEmergency(events[0].id, "CLOSED_SAFE", access.actorId);
    await closeEmergency(events[0].id, "CLOSED_ENDED", access.actorId, "Later close");
    expect(await db.emergencyEvents.get(events[0].id)).toMatchObject({ status: "CLOSED_SAFE" });
  });

  it("keeps only the newest GPS position, stops queueing after close and purges after confirmation", async () => {
    const { space, access } = await setup();
    const event = await createEmergency(space, access);
    const position: EmergencyPosition = { lat: 10, lng: 106, accuracy: 15, capturedAt: "2026-10-13T00:00:00Z", provenance: "CURRENT" };
    await saveEmergencyPosition(event.id, access.actorId, position);
    await saveEmergencyPosition(event.id, access.actorId, { ...position, lat: 11, capturedAt: "2026-10-12T23:59:00Z" });
    expect(await db.emergencyEvents.get(event.id)).toMatchObject({ position });
    await closeEmergency(event.id, "CLOSED_SAFE", access.actorId);
    await saveEmergencyPosition(event.id, access.actorId, { ...position, lat: 12 });
    expect(await db.emergencyQueue.get(`${event.id}:LOCATION`)).toBeUndefined();
    await db.emergencyEvents.update(event.id, { serverClosedConfirmedAt: "2026-10-13T01:00:00Z" });
    await purgeExpiredEmergencyPositions(Date.parse("2026-10-14T00:59:59Z"));
    expect((await db.emergencyEvents.get(event.id))?.position).toBeDefined();
    await purgeExpiredEmergencyPositions(Date.parse("2026-10-14T01:00:00Z"));
    expect((await db.emergencyEvents.get(event.id))?.position).toBeUndefined();
  });
});

describe("location and dialer labels", () => {
  it("rejects malformed imported coordinates, dates and unsafe contact URLs", async () => {
    const { space, access } = await setup(false); const event = await createEmergency(space, access);
    expect(emergencyRecordSchema.safeParse(event).success).toBe(true);
    expect(emergencyRecordSchema.safeParse({ ...event, createdAt: "not a date" }).success).toBe(false);
    expect(emergencyRecordSchema.safeParse({ ...event, position: { lat: "10", lng: 106, accuracy: 15, capturedAt: event.createdAt, provenance: "CURRENT" } }).success).toBe(false);
    expect(emergencyContactSchema.safeParse({ id: event.id, spaceId: space.id, name: "Contact", phone: "javascript:alert(1)" }).success).toBe(false);
  });
  it("requires all approved LIVE conditions and rejects future, cached or stopped samples", () => {
    const now = Date.parse("2026-10-13T00:00:00Z");
    const position: EmergencyPosition = { lat: 10, lng: 106, accuracy: 15, capturedAt: new Date(now - 60_000).toISOString(), provenance: "CURRENT" };
    expect(locationLabel(position, "ACTIVE", true, true, now)).toBe("LIVE");
    expect(locationLabel(position, "ACTIVE", true, true, now + 1)).toBe("LAST");
    for (const [status, watching, foreground] of [["CLOSED_SAFE", true, true], ["ACTIVE", false, true], ["ACTIVE", true, false]] as const) expect(locationLabel(position, status, watching, foreground, now)).toBe("LAST");
    expect(locationLabel({ ...position, capturedAt: new Date(now + 1).toISOString() }, "ACTIVE", true, true, now)).toBe("LAST");
    expect(locationLabel({ ...position, provenance: "LAST_KNOWN" }, "ACTIVE", true, true, now)).toBe("LAST");
  });
  it("constructs tel URLs only from validated phone numbers", () => {
    expect(normalizedPhone("+84 (90) 123-4567")).toBe("+84901234567");
    expect(dialerUrl("115")).toBe("tel:115");
    for (const value of ["javascript:alert(1)", "tel:115", "115?body=secret", "*123#", "12", "1234567890123456"]) expect(dialerUrl(value)).toBeNull();
  });
});
