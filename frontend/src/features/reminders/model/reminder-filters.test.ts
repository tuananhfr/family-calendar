import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import type { Item } from "@/core/model/item";
import type { ReminderRule } from "@/core/model/reminder-rule";
import { getActive } from "@/core/repo/read";
import { createLocalSpace, saveResource } from "@/core/repo/write";
import { makeItem, makeRule } from "@/core/test-support/items";
import { filterReminders, reminderTabOf, setReminderEnabled, toReminderViews, type ReminderTab } from "./reminder-filters";

const items = [
  makeItem({ kind: "REMINDER", preset: "MEDICATION", category: "HEALTH", title: "Uống thuốc" }),
  makeItem({ kind: "EVENT", preset: "APPOINTMENT", category: "STUDY", title: "Họp phụ huynh" }),
  makeItem({ kind: "REMINDER", preset: "DOCUMENT", category: "DOCUMENT", title: "Hộ chiếu" }),
  makeItem({ kind: "REMINDER", preset: "PAYMENT", category: "FINANCE", title: "Tiền điện" }),
  makeItem({ kind: "EVENT", preset: "BIRTHDAY", category: "SPECIAL", title: "Sinh nhật Bà" }),
  makeItem({ kind: "REMINDER", preset: "REMEMBER", category: "OTHER", title: "Gọi cho bà" }),
  makeItem({ kind: "EVENT", preset: "EVENT", category: "FAMILY", title: "Không có nhắc" }),
];
const rules = items.slice(0, 6).map((i) => makeRule(i));
const views = toReminderViews(items, rules);

function titles(tab: ReminderTab) {
  return filterReminders(views, tab).map((v) => v.item.title);
}

describe("reminder list", () => {
  it("lists items that have a rule, never items without one", () => {
    expect(views.map((v) => v.item.title)).not.toContain("Không có nhắc");
    expect(views).toHaveLength(6);
  });

  it.each([
    ["ALL", ["Uống thuốc", "Họp phụ huynh", "Hộ chiếu", "Tiền điện", "Sinh nhật Bà", "Gọi cho bà"]],
    ["HEALTH", ["Uống thuốc"]],
    ["STUDY", ["Họp phụ huynh"]],
    ["DOCUMENT", ["Hộ chiếu"]],
    ["PAYMENT", ["Tiền điện"]],
    ["SPECIAL", ["Sinh nhật Bà"]],
    ["OTHER", ["Gọi cho bà"]],
  ] as const)("tab %s", (tab, expected) => {
    expect(titles(tab)).toEqual(expected);
  });

  it("every item maps to exactly one non-ALL tab", () => {
    expect(items.map(reminderTabOf)).toEqual(["HEALTH", "STUDY", "DOCUMENT", "PAYMENT", "SPECIAL", "OTHER", "OTHER"]);
  });
});

describe("setReminderEnabled", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("turning the toggle off disables the rule and keeps the item", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    const { actorId } = await getLocalIdentity();
    const item = await saveResource("item", makeItem({ spaceId, createdByActorId: actorId, kind: "REMINDER", preset: "REMEMBER", category: "OTHER" }), "create");
    const rule = await saveResource("reminder_rule", makeRule(item, { createdByActorId: actorId }), "create");
    await setReminderEnabled(rule.id, false);
    expect((await getActive<ReminderRule>("reminder_rule", rule.id))?.enabled).toBe(false);
    expect(await getActive<Item>("item", item.id)).toBeDefined();
    await setReminderEnabled(rule.id, true);
    expect((await getActive<ReminderRule>("reminder_rule", rule.id))?.enabled).toBe(true);
  });

  it("unknown rule → NOT_FOUND", async () => {
    await expect(setReminderEnabled("00000000-0000-4000-8000-000000000000", false)).rejects.toThrow("NOT_FOUND");
  });
});
