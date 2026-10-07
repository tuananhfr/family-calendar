"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Member } from "@/core/model/member";
import type { ReminderRule } from "@/core/model/reminder-rule";
import { listActive } from "@/core/repo/read";
import { timePart } from "@/core/time/zoned";
import { useOccurrences } from "@/features/items";
import { useActiveSpace, useMembers } from "@/features/members";
import { toReminderViews, type ReminderView } from "../model/reminder-filters";

/** One /nhac row per item: an item with two rules (30 phút trước + đúng giờ) is still one reminder with one switch. */
export interface ReminderRow extends ReminderView {
  rules: ReminderRule[];
  enabled: boolean;
}

export function useReminderList(): { loading: boolean; rows: ReminderRow[]; members: Member[] } {
  const { space } = useActiveSpace();
  const spaceId = space?.id;
  const members = useMembers(spaceId);
  // No window: only the readable items are needed, not their occurrences.
  const occ = useOccurrences(null);
  const rules = useLiveQuery(async () => (spaceId ? listActive<ReminderRule>("reminder_rule", spaceId) : []), [spaceId]);

  return useMemo(() => {
    const byItem = new Map<string, ReminderRow>();
    for (const v of toReminderViews(occ.items, rules ?? [])) {
      const row = byItem.get(v.item.id);
      if (row) row.rules.push(v.rule);
      else byItem.set(v.item.id, { ...v, rules: [v.rule], enabled: false });
    }
    const rows = [...byItem.values()].map((r) => ({ ...r, enabled: r.rules.some((x) => x.enabled !== false) }));
    rows.sort((a, b) => {
      const ta = a.item.schedule.allDay ? "99:99" : (timePart(a.item.schedule.start) ?? "");
      const tb = b.item.schedule.allDay ? "99:99" : (timePart(b.item.schedule.start) ?? "");
      return ta < tb ? -1 : ta > tb ? 1 : a.item.title.localeCompare(b.item.title, "vi");
    });
    return { loading: occ.loading || rules === undefined || members === undefined, rows, members: members ?? [] };
  }, [occ, rules, members]);
}
