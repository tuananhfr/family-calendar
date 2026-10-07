import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/db";
import { getLocalIdentity } from "../db/local-identity";
import { newId } from "../ids";
import type { ItemExceptionRecord } from "../model/occurrence";
import { occurrenceKey } from "../recurrence/occurrence-key";
import { createLocalSpace, saveResource } from "../repo/write";
import { makeItem, makeRule, makeState } from "../test-support/items";
import { baseFields } from "../test-support/records";
import { computeDueTriggers, scanOnce, startForegroundScanner, triggerId, type DueTriggerInput } from "./foreground-scanner";

const TZ = "Asia/Ho_Chi_Minh";
const med = makeItem({
  kind: "REMINDER",
  preset: "MEDICATION",
  category: "HEALTH",
  dataClass: "SENSITIVE",
  sharingScope: "PRIVATE",
  title: "Thuốc huyết áp Amlodipin",
  schedule: { allDay: false, start: "2026-10-01T07:00", timeZone: TZ, rrule: "FREQ=DAILY" },
});
const medRule = makeRule(med, { offsetsMinutes: [0] });
const key = occurrenceKey(med.id, "2026-10-06T07:00");

/** 07:00 local on 6/10 is 00:00 UTC. */
const at = (localHhmmss: string) => new Date(`2026-10-06T${localHhmmss}+07:00`);

function input(overrides: Partial<DueTriggerInput> = {}): DueTriggerInput {
  return {
    items: [med],
    rules: [medRule],
    states: [],
    exceptions: [],
    now: at("07:00:30"),
    lookbackMinutes: 6 * 60,
    horizonMinutes: 0,
    timeZoneOf: () => TZ,
    ...overrides,
  };
}

describe("computeDueTriggers", () => {
  it("a 07:00 trigger is due at 07:00:30", () => {
    const [t, ...rest] = computeDueTriggers(input());
    expect(rest).toEqual([]);
    expect(t).toMatchObject({ itemId: med.id, occurrenceKey: key, ruleId: medRule.id, offsetMinutes: 0, status: "DUE" });
    expect(t.fireAt.toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });

  it("nothing is due a minute before", () => {
    expect(computeDueTriggers(input({ now: at("06:59:00"), lookbackMinutes: 60 })).filter((t) => t.occurrenceKey === key)).toEqual([]);
  });

  it("a trigger recorded in firedReminders is not returned again (reload)", () => {
    const [t] = computeDueTriggers(input());
    expect(computeDueTriggers(input({ fired: new Set([triggerId(t)]) }))).toEqual([]);
  });

  it("DONE before the time → no trigger", () => {
    expect(computeDueTriggers(input({ states: [makeState(med, "2026-10-06T07:00", "DONE")] }))).toEqual([]);
  });

  it("SKIPPED → no trigger", () => {
    expect(computeDueTriggers(input({ states: [makeState(med, "2026-10-06T07:00", "SKIPPED")] }))).toEqual([]);
  });

  it("SNOOZE 10 minutes replaces the 07:00 trigger with one at 07:10", () => {
    const snoozed = makeState(med, "2026-10-06T07:00", "SNOOZED", { snoozeUntil: "2026-10-06T00:10:00.000Z" });
    expect(computeDueTriggers(input({ states: [snoozed], now: at("07:05:00") }))).toEqual([]);
    const due = computeDueTriggers(input({ states: [snoozed], now: at("07:10:05") }));
    expect(due).toHaveLength(1);
    expect(due[0].fireAt.toISOString()).toBe("2026-10-06T00:10:00.000Z");
    expect(due[0].snoozedUntil).toBe("2026-10-06T00:10:00.000Z");
    expect(triggerId(due[0])).not.toBe(triggerId(computeDueTriggers(input())[0]));
  });

  it("a cancelled occurrence never fires", () => {
    const cancel = { ...baseFields(), itemId: med.id, occurrenceKey: key, kind: "CANCEL" } as ItemExceptionRecord;
    expect(computeDueTriggers(input({ exceptions: [cancel] }))).toEqual([]);
  });

  it("medication 3 hours late (grace 60 min) is MISSED, not fired", () => {
    const [t] = computeDueTriggers(input({ now: at("10:00:00") }));
    expect(t).toMatchObject({ occurrenceKey: key, status: "MISSED" });
  });

  it("medication 30 minutes late is still fired", () => {
    const [t] = computeDueTriggers(input({ now: at("07:30:00") }));
    expect(t.status).toBe("DUE");
  });

  it("non-medication reminders inside the lookback still fire late", () => {
    const call = makeItem({ kind: "REMINDER", preset: "REMEMBER", category: "OTHER", schedule: { allDay: false, start: "2026-10-06T07:00", timeZone: TZ } });
    const [t] = computeDueTriggers(input({ items: [call], rules: [makeRule(call)], now: at("10:00:00") }));
    expect(t.status).toBe("DUE");
  });

  it("several offsets give one trigger each; upcoming ones appear within the horizon", () => {
    const rule = makeRule(med, { offsetsMinutes: [10, 0] });
    const due = computeDueTriggers(input({ rules: [rule], now: at("06:55:00"), lookbackMinutes: 10, horizonMinutes: 10 }));
    expect(due.map((t) => [t.offsetMinutes, t.fireAt.toISOString()])).toEqual([
      [10, "2026-10-05T23:50:00.000Z"],
      [0, "2026-10-06T00:00:00.000Z"],
    ]);
  });

  it("all-day documents fire at 08:00 local; month offsets are clamped calendar months", () => {
    const passport = makeItem({ kind: "REMINDER", preset: "DOCUMENT", category: "DOCUMENT", start: "2027-08-31" });
    const rule = makeRule(passport, { offsetsMinutes: [], offsetMonths: [6] });
    const [t] = computeDueTriggers(
      input({ items: [passport], rules: [rule], now: new Date("2027-02-28T08:00:30+07:00"), lookbackMinutes: 60 }),
    );
    expect(t).toMatchObject({ offsetMonths: 6, status: "DUE" });
    expect(t.fireAt.toISOString()).toBe("2027-02-28T01:00:00.000Z");
    expect(triggerId(t)).toBe(`${rule.id}|${occurrenceKey(passport.id, "2027-08-31")}|6M`);
  });

  it("disabled rules and deleted items are ignored", () => {
    expect(computeDueTriggers(input({ rules: [{ ...medRule, enabled: false }] }))).toEqual([]);
    expect(computeDueTriggers(input({ items: [{ ...med, deletedAt: "2026-10-06T00:00:00.000Z" }] }))).toEqual([]);
  });

  it("uses the item's time zone, not the machine's", () => {
    const ny = makeItem({ kind: "REMINDER", preset: "REMEMBER", category: "OTHER", schedule: { allDay: false, start: "2026-10-06T07:00", timeZone: "America/New_York" } });
    const [t] = computeDueTriggers(
      input({ items: [ny], rules: [makeRule(ny)], now: new Date("2026-10-06T11:00:30Z"), timeZoneOf: (i) => i.schedule.timeZone }),
    );
    expect(t.fireAt.toISOString()).toBe("2026-10-06T11:00:00.000Z");
  });

  it("triggerId is rule|occurrence|offset", () => {
    const [t] = computeDueTriggers(input());
    expect(triggerId(t)).toBe(`${medRule.id}|${key}|0`);
  });
});

describe("scanOnce", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  async function seed() {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    const { actorId } = await getLocalIdentity();
    const item = await saveResource("item", { ...med, id: newId(), spaceId, createdByActorId: actorId }, "create");
    await saveResource("reminder_rule", makeRule(item, { createdByActorId: actorId }), "create");
    return { spaceId, actorId, item };
  }

  it("fires once, stores a safe notification, and does not fire again on the next scan", async () => {
    const { item } = await seed();
    const onFire = vi.fn();
    await scanOnce({ now: at("07:00:30"), onFire });
    expect(onFire).toHaveBeenCalledTimes(1);
    const [notification] = await db.notifications.toArray();
    expect(notification).toMatchObject({ type: "REMINDER_DUE", resourceRef: { type: "occurrence", id: expect.stringContaining(item.id) }, readAt: null });
    expect(notification.titleSafe).toBe("Mở ứng dụng để xem nhắc của bạn.");
    expect(JSON.stringify(await db.notifications.toArray())).not.toContain("Amlodipin");
    await scanOnce({ now: at("07:01:30"), onFire });
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(await db.firedReminders.count()).toBe(1);
  });

  it("does not ring for a time that passed before the item was created", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    const { actorId } = await getLocalIdentity();
    const created = at("08:00:00").toISOString();
    const item = await saveResource("item", { ...med, id: newId(), spaceId, createdByActorId: actorId, createdAt: created, updatedAt: created }, "create");
    await saveResource("reminder_rule", makeRule(item, { createdByActorId: actorId }), "create");
    const onFire = vi.fn();
    await scanOnce({ now: at("08:00:30"), onFire });
    expect(onFire).not.toHaveBeenCalled();
    expect(await db.firedReminders.count()).toBe(0);
  });

  it("records a missed medication without notifying", async () => {
    await seed();
    const onFire = vi.fn();
    await scanOnce({ now: at("10:00:00"), onFire });
    expect(onFire).not.toHaveBeenCalled();
    expect(await db.notifications.count()).toBe(0);
    const [row] = await db.firedReminders.toArray();
    expect(row).toMatchObject({ outcome: "MISSED" });
  });

  it("never fires another actor's PRIVATE reminder on this device", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    const item = await saveResource("item", { ...med, id: newId(), spaceId, createdByActorId: newId() }, "create");
    await saveResource("reminder_rule", makeRule(item), "create");
    const onFire = vi.fn();
    await scanOnce({ now: at("07:00:30"), onFire });
    expect(onFire).not.toHaveBeenCalled();
  });
});

describe("startForegroundScanner lock", () => {
  it("a scanner stopped before its lock is granted hands the lock straight back", async () => {
    // Like Web Locks: the grant arrives on a later task, and an abort that comes after acquisition is ignored.
    const held: Array<Promise<void>> = [];
    const locks = {
      request: (_name: string, _opts: unknown, cb: () => Promise<void>) =>
        new Promise<void>((done) =>
          setTimeout(() => {
            const p = cb();
            held.push(p);
            void p.then(done);
          }, 0),
        ),
    };
    vi.stubGlobal("navigator", { locks });
    try {
      const stop = startForegroundScanner({ onFire: vi.fn(), onError: () => {} });
      stop();
      await new Promise((r) => setTimeout(r, 10));
      expect(held).toHaveLength(1);
      const outcome = await Promise.race([held[0].then(() => "released"), new Promise((r) => setTimeout(() => r("held"), 50))]);
      expect(outcome).toBe("released");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
