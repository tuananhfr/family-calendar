"use client";

import { useMemo } from "react";
import type { EditScope } from "@/core/recurrence/edit-scope";
import { useActiveSpace } from "@/features/members";
import type { ItemFormValues } from "../model/form-to-item";
import { createItemFromForm, removeItem, updateItemFromForm, type WriteContext } from "../model/item-writes";
import { actOnOccurrence } from "../model/act-on-occurrence";
import type { OccurrenceAction } from "../model/occurrence-actions";

export interface ItemMutations {
  ready: boolean;
  create(v: ItemFormValues): Promise<string>;
  update(id: string, v: ItemFormValues, scope: EditScope, occurrenceKey?: string): Promise<string>;
  remove(id: string, scope: EditScope, occurrenceKey?: string): Promise<void>;
  act(itemId: string, occurrenceKey: string, action: OccurrenceAction, snoozeMinutes?: number): Promise<void>;
}

/** Item writes bound to the active Space; throw ItemFormError / StorageFullError for the caller to show. */
export function useItemMutations(): ItemMutations {
  const { space } = useActiveSpace();
  return useMemo(() => {
    const ctx = (): WriteContext => {
      if (!space) throw new Error("NO_ACTIVE_SPACE");
      return { spaceId: space.id, timeZone: space.timeZone, spaceKind: space.kind };
    };
    return {
      ready: !!space,
      create: (v) => createItemFromForm(v, ctx()),
      update: (id, v, scope, key) => updateItemFromForm(id, v, scope, key, ctx()),
      remove: (id, scope, key) => removeItem(id, scope, key),
      act: (itemId, key, action, minutes) => actOnOccurrence(itemId, key, action, minutes),
    };
  }, [space]);
}
