import { db, type FiredReminderRow } from "../db/db";
import { getLocalIdentity } from "../db/local-identity";
import type { Item } from "../model/item";
import type { ItemExceptionRecord, OccurrenceState } from "../model/occurrence";
import type { ReminderRule } from "../model/reminder-rule";
import { expandOccurrences } from "../recurrence/expand";
import { listActive, listSpaces } from "../repo/read";
import { addDays } from "../time/local-date";
import { addMonthsClamped } from "../time/month-offset";
import { datePart, todayIn, zonedToInstant } from "../time/zoned";
import { safeNotificationText } from "./safe-text";

export interface DueTrigger {
  itemId: string;
  spaceId: string;
  occurrenceKey: string;
  ruleId: string;
  fireAt: Date;
  /** Minutes before the occurrence start; 0 for month offsets and snoozes. */
  offsetMinutes: number;
  offsetMonths?: number;
  /** Set for the trigger created by a SNOOZE of this occurrence. */
  snoozedUntil?: string;
  /** MISSED: medication past its grace window — recorded, never shown late (reminders.md). */
  status: "DUE" | "MISSED";
}

export interface DueTriggerInput {
  items: Item[];
  rules: ReminderRule[];
  states: OccurrenceState[];
  exceptions: ItemExceptionRecord[];
  now: Date;
  lookbackMinutes: number;
  horizonMinutes: number;
  timeZoneOf(item: Item): string;
  /** triggerId()s already in db.firedReminders. */
  fired?: ReadonlySet<string>;
  medicationGraceMinutes?: number;
}

/** All-day items have no time; they remind at this local hour instead of midnight (reminders.md). */
export const ALL_DAY_FIRE_TIME = "08:00";
export const MEDICATION_GRACE_MINUTES = 60;
export const DEFAULT_SCAN_INTERVAL_MS = 30_000;
export const DEFAULT_LOOKBACK_MINUTES = 24 * 60;
const SCAN_LOCK = "fc-reminder-scan";

/** Dedupe key stored in db.firedReminders. */
export function triggerId(t: Pick<DueTrigger, "ruleId" | "occurrenceKey" | "offsetMinutes" | "offsetMonths" | "snoozedUntil">): string {
  const offset = t.snoozedUntil ? `snooze@${t.snoozedUntil}` : t.offsetMonths ? `${t.offsetMonths}M` : String(t.offsetMinutes);
  return `${t.ruleId}|${t.occurrenceKey}|${offset}`;
}

function latestStates(states: OccurrenceState[]): Map<string, OccurrenceState> {
  const map = new Map<string, OccurrenceState>();
  for (const s of states) {
    if (s.deletedAt !== null) continue;
    const prev = map.get(s.occurrenceKey);
    if (!prev || prev.updatedAt < s.updatedAt) map.set(s.occurrenceKey, s);
  }
  return map;
}

/**
 * Reminder triggers whose fire time lies in [now − lookback, now + horizon]. DONE/SKIPPED occurrences produce
 * nothing; a SNOOZED occurrence only produces its snooze trigger. Pure: the caller filters `fireAt <= now`.
 */
export function computeDueTriggers(input: DueTriggerInput): DueTrigger[] {
  const lo = input.now.getTime() - input.lookbackMinutes * 60_000;
  const hi = input.now.getTime() + input.horizonMinutes * 60_000;
  const graceMs = (input.medicationGraceMinutes ?? MEDICATION_GRACE_MINUTES) * 60_000;
  const items = new Map(input.items.filter((i) => i.deletedAt === null).map((i) => [i.id, i]));
  const states = latestStates(input.states);
  const fired = input.fired ?? new Set<string>();
  const snoozeOwner = new Map<string, string>();
  const out: DueTrigger[] = [];

  const push = (t: Omit<DueTrigger, "status">, item: Item) => {
    const at = t.fireAt.getTime();
    if (at < lo || at > hi || fired.has(triggerId(t))) return;
    const missed = item.preset === "MEDICATION" && at < input.now.getTime() - graceMs;
    out.push({ ...t, status: missed ? "MISSED" : "DUE" });
  };

  for (const rule of input.rules) {
    if (rule.deletedAt !== null || rule.enabled === false) continue;
    const item = items.get(rule.itemId);
    if (!item) continue;
    const tz = input.timeZoneOf(item);
    const maxDays = Math.ceil(Math.max(0, ...rule.offsetsMinutes) / 1440) + Math.max(0, ...(rule.offsetMonths ?? [])) * 31 + 1;
    const from = addDays(todayIn(tz, new Date(lo)), -1);
    const to = addDays(todayIn(tz, new Date(hi)), maxDays);
    const exceptions = input.exceptions.filter((e) => e.itemId === item.id && e.deletedAt === null);
    if (!snoozeOwner.has(item.id)) snoozeOwner.set(item.id, rule.id);

    for (const occ of expandOccurrences(item.id, item.schedule, { from, to }, exceptions)) {
      if (states.has(occ.occurrenceKey)) continue;
      const local = occ.allDay ? `${occ.start}T${ALL_DAY_FIRE_TIME}` : occ.start;
      const startMs = zonedToInstant(local, tz).getTime();
      const base = { itemId: item.id, spaceId: item.spaceId, occurrenceKey: occ.occurrenceKey, ruleId: rule.id };
      for (const offset of rule.offsetsMinutes) push({ ...base, fireAt: new Date(startMs - offset * 60_000), offsetMinutes: offset }, item);
      for (const months of rule.offsetMonths ?? []) {
        const day = addMonthsClamped(datePart(occ.start), -months);
        push({ ...base, fireAt: zonedToInstant(`${day}${local.slice(10)}`, tz), offsetMinutes: 0, offsetMonths: months }, item);
      }
    }
  }

  // A snooze fires once per occurrence, through the item's first enabled rule.
  for (const s of states.values()) {
    if (s.status !== "SNOOZED" || !s.snoozeUntil) continue;
    const item = items.get(s.itemId);
    const ruleId = snoozeOwner.get(s.itemId);
    if (!item || !ruleId) continue;
    push(
      { itemId: item.id, spaceId: item.spaceId, occurrenceKey: s.occurrenceKey, ruleId, fireAt: new Date(s.snoozeUntil), offsetMinutes: 0, snoozedUntil: s.snoozeUntil },
      item,
    );
  }

  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || triggerId(a).localeCompare(triggerId(b)));
}

export interface FiredReminderRecord extends FiredReminderRow {
  ruleId: string;
  itemId: string;
  outcome: "FIRED" | "MISSED";
}

export interface ScanOptions {
  now?: Date;
  onFire(t: DueTrigger, text: { title: string; body: string }): void;
  lookbackMinutes?: number;
  /** Defaults to the `notifications.showDetails` setting, then true. SENSITIVE stays generic regardless. */
  showDetails?: boolean;
}

/** One scan over every local Space: records each due trigger once (firedReminders) and adds a safe notification. */
export async function scanOnce(opts: ScanOptions): Promise<DueTrigger[]> {
  const now = opts.now ?? new Date();
  const { actorId } = await getLocalIdentity();
  const showDetails = opts.showDetails ?? ((await db.settings.get("notifications.showDetails"))?.value !== false);
  const fired = new Set((await db.firedReminders.toCollection().primaryKeys()) as string[]);
  const handled: DueTrigger[] = [];

  for (const space of await listSpaces()) {
    // Another actor's PRIVATE reminder may sit in this device's cache of a shared Space; never surface it here.
    const items = (await listActive<Item>("item", space.id)).filter((i) => i.sharingScope !== "PRIVATE" || i.createdByActorId === actorId);
    const triggers = computeDueTriggers({
      items,
      rules: await listActive<ReminderRule>("reminder_rule", space.id),
      states: await listActive<OccurrenceState>("occurrence_state", space.id),
      exceptions: await listActive<ItemExceptionRecord>("item_exception", space.id),
      now,
      lookbackMinutes: opts.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES,
      horizonMinutes: 0,
      timeZoneOf: (i) => i.schedule.timeZone || space.timeZone,
      fired,
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    // A time that passed before the item existed was never pending: adding "07:00" at 08:00 must not ring at once.
    const due = triggers.filter((t) => t.fireAt.getTime() <= now.getTime() && (t.snoozedUntil !== undefined || t.fireAt.toISOString() >= byId.get(t.itemId)!.createdAt));

    for (const t of due) {
      const id = triggerId(t);
      const text = safeNotificationText(byId.get(t.itemId)!, showDetails);
      // The check-and-insert runs in one transaction so two scans (or tabs without Web Locks) can't both fire.
      const isNew = await db.transaction("rw", db.firedReminders, db.notifications, async () => {
        if (await db.firedReminders.get(id)) return false;
        const row: FiredReminderRecord = {
          id,
          spaceId: t.spaceId,
          occurrenceKey: t.occurrenceKey,
          firedAt: now.toISOString(),
          ruleId: t.ruleId,
          itemId: t.itemId,
          outcome: t.status === "DUE" ? "FIRED" : "MISSED",
        };
        await db.firedReminders.add(row);
        if (t.status === "DUE") {
          await db.notifications.add({
            id: crypto.randomUUID?.() ?? `${id}|n`,
            spaceId: t.spaceId,
            type: "REMINDER_DUE",
            // The occurrence key carries the item id and lets the center open that exact occurrence.
            resourceRef: { type: "occurrence", id: t.occurrenceKey },
            titleSafe: text.body,
            createdAt: now.toISOString(),
            readAt: null,
          });
        }
        return true;
      });
      fired.add(id);
      if (!isNew) continue;
      handled.push(t);
      if (t.status === "DUE") opts.onFire(t, text);
    }
  }
  return handled;
}

/**
 * Scans every `intervalMs` while the app is open. A Web Lock makes exactly one tab the scanner; the others wait
 * and take over when it closes. Returns a stop function.
 */
export function startForegroundScanner(opts: {
  intervalMs?: number;
  onFire(t: DueTrigger, text: { title: string; body: string }): void;
  onError?(error: unknown): void;
  now?: () => Date;
}): () => void {
  const interval = opts.intervalMs ?? DEFAULT_SCAN_INTERVAL_MS;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let release: (() => void) | undefined;
  const abort = new AbortController();

  const loop = async () => {
    if (stopped) return;
    try {
      await scanOnce({ now: opts.now?.(), onFire: opts.onFire });
    } catch (error) {
      opts.onError?.(error);
    }
    if (!stopped) timer = setTimeout(loop, interval);
  };

  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (locks?.request) {
    locks
      .request(SCAN_LOCK, { signal: abort.signal }, () => new Promise<void>((resolve) => {
        // Granted after stop (abort is ignored once the lock is acquired): hand it straight back, or the next
        // scanner in this tab — e.g. React remounting the host — waits forever and no reminder ever rings.
        if (stopped) return resolve();
        release = resolve;
        void loop();
      }))
      .catch((error: unknown) => {
        if (!stopped) opts.onError?.(error);
      });
  } else {
    void loop();
  }

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    abort.abort();
    release?.();
  };
}
