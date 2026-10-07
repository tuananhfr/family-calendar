import { RepoError } from "@/core/db/errors";
import { isSpecialDayPreset } from "@/core/model/common";
import type { Item } from "@/core/model/item";
import type { ReminderRule } from "@/core/model/reminder-rule";
import { getActive } from "@/core/repo/read";
import { saveResource } from "@/core/repo/write";

export const REMINDER_TABS = ["ALL", "HEALTH", "STUDY", "DOCUMENT", "PAYMENT", "SPECIAL", "OTHER"] as const;
export type ReminderTab = (typeof REMINDER_TABS)[number];

export interface ReminderView {
  item: Item;
  rule: ReminderRule;
}

/** A row of /nhac is a rule with its item; items without a rule (plain events) are not reminders. */
export function toReminderViews(items: Item[], rules: ReminderRule[]): ReminderView[] {
  const byItem = new Map<string, ReminderRule[]>();
  for (const r of rules) {
    if (r.deletedAt !== null) continue;
    byItem.set(r.itemId, [...(byItem.get(r.itemId) ?? []), r]);
  }
  return items.filter((i) => i.deletedAt === null).flatMap((item) => (byItem.get(item.id) ?? []).map((rule) => ({ item, rule })));
}

/** The single category tab a reminder belongs to (besides ALL). */
export function reminderTabOf(item: Item): Exclude<ReminderTab, "ALL"> {
  if (item.category === "HEALTH" || item.preset === "MEDICATION") return "HEALTH";
  if (item.preset === "DOCUMENT" || item.category === "DOCUMENT") return "DOCUMENT";
  if (item.preset === "PAYMENT" || item.category === "FINANCE") return "PAYMENT";
  if (isSpecialDayPreset(item.preset) || item.category === "SPECIAL") return "SPECIAL";
  if (item.category === "STUDY") return "STUDY";
  return "OTHER";
}

export function filterReminders(views: ReminderView[], tab: ReminderTab): ReminderView[] {
  return tab === "ALL" ? views : views.filter((v) => reminderTabOf(v.item) === tab);
}

/** The on/off toggle: only the rule changes, the item stays on the calendar. */
export async function setReminderEnabled(ruleId: string, enabled: boolean): Promise<ReminderRule> {
  const rule = await getActive<ReminderRule>("reminder_rule", ruleId);
  if (!rule) throw new RepoError("NOT_FOUND", ruleId);
  return saveResource("reminder_rule", { ...rule, enabled }, "update");
}
