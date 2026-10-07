"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { Item } from "@/core/model/item";
import type { ChecklistItem, ChecklistState, ItemExceptionRecord, OccurrenceState, Participation } from "@/core/model/occurrence";
import type { ReminderRule } from "@/core/model/reminder-rule";
import { parseOccurrenceKey } from "@/core/recurrence/occurrence-key";
import { getActive, listActiveByItem } from "@/core/repo/read";
import { occurrenceStatesByKey } from "../model/occurrence-actions";
import { isRecurring, occurrenceAt } from "../model/item-writes";

export interface OccurrenceDetail {
  item: Item;
  occurrence: ReturnType<typeof occurrenceAt>;
  recurring: boolean;
  state?: OccurrenceState;
  hasRule: boolean;
  checklist: Array<{ line: ChecklistItem; checked: boolean }>;
  participations: Participation[];
}

/** Live detail of one occurrence; `null` when the item is gone, `undefined` while loading. */
export function useOccurrenceDetail(itemId: string, key: string): OccurrenceDetail | null | undefined {
  return useLiveQuery(async () => {
    const item = await getActive<Item>("item", itemId);
    const parsed = parseOccurrenceKey(key);
    if (!item || !parsed || parsed.itemId !== itemId) return null;
    const [exceptions, states, lines, checks, rules, participations] = await Promise.all([
      listActiveByItem<ItemExceptionRecord>("item_exception", itemId),
      listActiveByItem<OccurrenceState>("occurrence_state", itemId),
      listActiveByItem<ChecklistItem>("checklist_item", itemId),
      listActiveByItem<ChecklistState>("checklist_state", itemId),
      listActiveByItem<ReminderRule>("reminder_rule", itemId),
      listActiveByItem<Participation>("participation", itemId),
    ]);
    const occurrence = occurrenceAt(item, exceptions, parsed.originalStart);
    if (occurrence.cancelled) return null;
    const checked = new Set(checks.filter((c) => c.occurrenceKey === key && c.checked).map((c) => c.checklistItemId));
    return {
      item,
      occurrence,
      recurring: isRecurring(item),
      state: occurrenceStatesByKey(states).get(key),
      hasRule: rules.some((r) => r.enabled !== false),
      checklist: lines.sort((a, b) => a.position - b.position).map((line) => ({ line, checked: checked.has(line.id) })),
      participations: participations.filter((p) => p.occurrenceKey === key),
    };
  }, [itemId, key]);
}
