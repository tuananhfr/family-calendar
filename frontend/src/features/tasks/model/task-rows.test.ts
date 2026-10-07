import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import type { Item } from "@/core/model/item";
import type { OccurrenceState } from "@/core/model/occurrence";
import { getActive } from "@/core/repo/read";
import { createLocalSpace, saveResource } from "@/core/repo/write";
import { makeItem, occurrenceOf } from "@/core/test-support/items";
import { setTaskPriority } from "./task-actions";
import { applyTaskFilters, taskRows } from "./task-rows";

const TODAY = "2026-10-06";

function done(item: Item, start: string): OccurrenceState {
  return { occurrenceKey: occurrenceOf(item, start).occurrenceKey, status: "DONE", deletedAt: null } as OccurrenceState;
}

describe("task rows", () => {
  const once = makeItem({ kind: "TASK", preset: "OTHER", title: "Mua sách", start: "2026-10-08", priority: "LOW" });
  const late = makeItem({ kind: "TASK", preset: "OTHER", title: "Nộp học phí", start: "2026-10-04", priority: "HIGH" });
  const daily = makeItem({
    kind: "TASK",
    preset: "HOUSEWORK",
    title: "Tưới cây",
    schedule: { allDay: true, start: "2026-10-01", timeZone: "Asia/Ho_Chi_Minh", rrule: "FREQ=DAILY" },
  });
  const event = makeItem({ kind: "EVENT", title: "Họp" });
  const dailyEntries = ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"].map((d) => ({ item: daily, occurrence: occurrenceOf(daily, d) }));
  const entries = [{ item: once, occurrence: occurrenceOf(once) }, { item: late, occurrence: occurrenceOf(late) }, { item: event, occurrence: occurrenceOf(event) }, ...dailyEntries];

  it("keeps one row per task, today's occurrence for a recurring one, overdue first", () => {
    const rows = taskRows(entries, [], TODAY);
    expect(rows.map((r) => [r.item.title, r.due])).toEqual([
      ["Nộp học phí", "2026-10-04"],
      ["Tưới cây", "2026-10-06"],
      ["Mua sách", "2026-10-08"],
    ]);
  });

  it("a done occurrence of today moves the chore to the done group", () => {
    const rows = taskRows(entries, [done(daily, "2026-10-06")], TODAY);
    expect(rows.at(-1)?.item.title).toBe("Tưới cây");
    expect(rows.at(-1)?.done).toBe(true);
  });

  it("filters by status and priority", () => {
    const rows = taskRows(entries, [], TODAY);
    expect(applyTaskFilters(rows, { status: "OVERDUE", priority: "ALL" }, TODAY).map((r) => r.item.title)).toEqual(["Nộp học phí"]);
    expect(applyTaskFilters(rows, { status: "ALL", priority: "LOW" }, TODAY).map((r) => r.item.title)).toEqual(["Mua sách"]);
  });
});

describe("setTaskPriority", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("changes the priority of the stored task", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    const { actorId } = await getLocalIdentity();
    const item = await saveResource("item", makeItem({ spaceId, createdByActorId: actorId, kind: "TASK", preset: "OTHER", category: "OTHER" }), "create");
    await setTaskPriority(item.id, "HIGH");
    expect((await getActive<Item>("item", item.id))?.priority).toBe("HIGH");
  });

  it("unknown task → NOT_FOUND", async () => {
    await expect(setTaskPriority("00000000-0000-4000-8000-000000000000", "LOW")).rejects.toThrow("NOT_FOUND");
  });
});
