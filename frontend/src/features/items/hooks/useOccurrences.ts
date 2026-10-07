"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { canReadItem } from "@/core/access/evaluate";
import type { Item } from "@/core/model/item";
import type { ItemExceptionRecord, OccurrenceState } from "@/core/model/occurrence";
import { expandOccurrences } from "@/core/recurrence/expand";
import type { DateWindow, Occurrence } from "@/core/recurrence/types";
import { listActive } from "@/core/repo/read";
import { useAccess, useActiveSpace } from "@/features/members";
import { occurrenceStatesByKey } from "../model/occurrence-actions";

export interface OccurrenceEntry {
  item: Item;
  occurrence: Occurrence;
  state?: OccurrenceState;
}

export interface OccurrencesResult {
  /** Readable occurrences overlapping the window, sorted by start. */
  entries: OccurrenceEntry[];
  /** Readable items of the Space (including ones with no occurrence in the window). */
  items: Item[];
  states: OccurrenceState[];
  loading: boolean;
}

/** Expands the active Space's items into occurrences for a window, after access filtering (PRIVATE stays private). */
export function useOccurrences(window: DateWindow | null): OccurrencesResult {
  const { space } = useActiveSpace();
  const access = useAccess();
  const spaceId = space?.id;
  const raw = useLiveQuery(
    async () => {
      if (!spaceId) return null;
      const [items, exceptions, states] = await Promise.all([
        listActive<Item>("item", spaceId),
        listActive<ItemExceptionRecord>("item_exception", spaceId),
        listActive<OccurrenceState>("occurrence_state", spaceId),
      ]);
      return { items, exceptions, states };
    },
    [spaceId],
  );
  const from = window?.from;
  const to = window?.to;

  return useMemo(() => {
    if (!raw || !access) return { entries: [], items: [], states: [], loading: true };
    const items = raw.items.filter((i) => canReadItem(access, i));
    const readable = new Set(items.map((i) => i.id));
    const states = raw.states.filter((s) => readable.has(s.itemId));
    if (!from || !to) return { entries: [], items, states, loading: false };
    const byKey = occurrenceStatesByKey(states);
    const entries: OccurrenceEntry[] = [];
    for (const item of items) {
      const exceptions = raw.exceptions.filter((e) => e.itemId === item.id);
      for (const occurrence of expandOccurrences(item.id, item.schedule, { from, to }, exceptions)) {
        entries.push({ item, occurrence, state: byKey.get(occurrence.occurrenceKey) });
      }
    }
    entries.sort((a, b) => (a.occurrence.start < b.occurrence.start ? -1 : a.occurrence.start > b.occurrence.start ? 1 : 0));
    return { entries, items, states, loading: false };
  }, [raw, access, from, to]);
}
