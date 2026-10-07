import { db } from "@/core/db/db";
import { RepoError } from "@/core/db/errors";
import { getLocalIdentity } from "@/core/db/local-identity";
import { newId } from "@/core/ids";
import type { Item } from "@/core/model/item";
import type { OccurrenceState, OccurrenceStatus } from "@/core/model/occurrence";
import { parseOccurrenceKey } from "@/core/recurrence/occurrence-key";
import { getActive, listActiveByItem } from "@/core/repo/read";
import { deleteResource, saveResource } from "@/core/repo/write";

export type OccurrenceAction = "DONE" | "SNOOZE" | "SKIP" | "UNDO";
export const DEFAULT_SNOOZE_MINUTES = 10;

const STATUS: Record<Exclude<OccurrenceAction, "UNDO">, OccurrenceStatus> = {
  DONE: "DONE",
  SNOOZE: "SNOOZED",
  SKIP: "SKIPPED",
};

/** Latest live state per occurrence key. */
export function occurrenceStatesByKey(states: OccurrenceState[]): Map<string, OccurrenceState> {
  const map = new Map<string, OccurrenceState>();
  for (const s of states) {
    if (s.deletedAt !== null) continue;
    const prev = map.get(s.occurrenceKey);
    if (!prev || prev.updatedAt < s.updatedAt) map.set(s.occurrenceKey, s);
  }
  return map;
}

function isOneOffTask(item: Item): boolean {
  return item.kind === "TASK" && !item.schedule.rrule && !item.schedule.lunarRule;
}

/**
 * DONE / SNOOZE / SKIP / UNDO for exactly one occurrence; the series (RRULE) is never touched. One state row per
 * occurrence key, updated in place, so a second tab acting on the same occurrence can't add a duplicate.
 */
export async function applyOccurrenceAction(
  itemId: string,
  occurrenceKey: string,
  action: OccurrenceAction,
  snoozeMinutes: number = DEFAULT_SNOOZE_MINUTES,
  opts: { now?: Date } = {},
): Promise<void> {
  const parsed = parseOccurrenceKey(occurrenceKey);
  if (!parsed || parsed.itemId !== itemId) throw new RangeError(`Occurrence key ${occurrenceKey} is not of item ${itemId}`);
  if (action === "SNOOZE" && (!Number.isInteger(snoozeMinutes) || snoozeMinutes <= 0)) {
    throw new RangeError("snoozeMinutes must be a positive integer");
  }
  const { actorId } = await getLocalIdentity();
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();

  await db.transaction("rw", [db.items, db.occurrenceStates, db.spaces, db.outbox], async () => {
    const item = await getActive<Item>("item", itemId);
    if (!item) throw new RepoError("NOT_FOUND", itemId);
    const current = occurrenceStatesByKey(await listActiveByItem<OccurrenceState>("occurrence_state", itemId)).get(occurrenceKey);

    if (action === "UNDO") {
      if (current) await deleteResource("occurrence_state", current.id);
    } else {
      const state: OccurrenceState = {
        id: current?.id ?? newId(),
        spaceId: item.spaceId,
        createdByActorId: current?.createdByActorId ?? actorId,
        // Same audience as the item: a PRIVATE/SENSITIVE item's completion is as private as the item.
        dataClass: item.dataClass,
        sharingScope: item.sharingScope,
        revision: current?.revision ?? null,
        createdAt: current?.createdAt ?? nowIso,
        updatedAt: nowIso,
        deletedAt: null,
        syncState: current?.syncState ?? "LOCAL",
        itemId,
        occurrenceKey,
        status: STATUS[action],
        actedAt: nowIso,
        actedByActorId: actorId,
        snoozeUntil: action === "SNOOZE" ? new Date(now.getTime() + snoozeMinutes * 60_000).toISOString() : null,
      };
      await saveResource("occurrence_state", state, "occurrence_action");
    }

    if (isOneOffTask(item)) {
      const completedAt = action === "DONE" ? nowIso : null;
      if ((item.completedAt ?? null) !== completedAt) await saveResource("item", { ...item, completedAt }, "update");
    }
  });
}
