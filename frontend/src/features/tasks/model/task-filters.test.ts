import { describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { makeItem, makeState, occurrenceOf } from "@/core/test-support/items";
import { dueLabel, filterTasks, taskStatus, toTaskViews, type TaskTab } from "./task-filters";

const me = newId();
const child = newId();
const actor = newId();

const tasks = [
  makeItem({ kind: "TASK", preset: "PERSONAL", category: "OTHER", title: "Việc của tôi", memberIds: [me], start: "2026-10-06" }),
  makeItem({ kind: "TASK", preset: "PERSONAL", category: "STUDY", title: "Làm bài tập", memberIds: [child], start: "2026-10-07" }),
  makeItem({ kind: "TASK", preset: "HOUSEWORK", category: "HOUSEWORK", title: "Rửa bát", responsibleMemberId: child, start: "2026-10-06" }),
  makeItem({ kind: "TASK", preset: "SHOPPING", category: "SHOPPING", title: "Mua sữa", start: "2026-10-05" }),
  makeItem({ kind: "TASK", preset: "PERSONAL", category: "FINANCE", title: "Đóng tiền điện", start: "2026-10-10" }),
  makeItem({ kind: "TASK", preset: "PERSONAL", category: "HEALTH", title: "Mua thuốc", start: "2026-10-12" }),
  makeItem({ kind: "TASK", preset: "PERSONAL", category: "OTHER", title: "Việc tôi tạo", createdByActorId: actor, start: "2026-10-06" }),
];
const views = toTaskViews(
  tasks.map((item) => ({ item, occurrence: occurrenceOf(item) })),
  [makeState(tasks[3], "2026-10-05", "DONE")],
);

function titles(tab: TaskTab, ctx = { usingMemberId: me, childMemberIds: [child], actorId: actor }) {
  return filterTasks(views, tab, ctx).map((v) => v.item.title);
}

describe("filterTasks", () => {
  it("ALL keeps everything", () => {
    expect(titles("ALL")).toHaveLength(7);
  });

  it("MINE: assigned to the member I'm using, or created by me without assignees", () => {
    expect(titles("MINE")).toEqual(["Việc của tôi", "Việc tôi tạo"]);
  });

  it("MINE is empty without a selected member or actor", () => {
    expect(titles("MINE", { usingMemberId: undefined as unknown as string, childMemberIds: [child], actorId: undefined as unknown as string })).toEqual([]);
  });

  it("CHILDREN: tasks given to a CHILD member (participant or responsible)", () => {
    expect(titles("CHILDREN")).toEqual(["Làm bài tập", "Rửa bát"]);
  });

  it.each([
    ["HOUSEWORK", ["Rửa bát"]],
    ["SHOPPING", ["Mua sữa"]],
    ["FINANCE", ["Đóng tiền điện"]],
    ["STUDY", ["Làm bài tập"]],
    ["HEALTH", ["Mua thuốc"]],
  ] as const)("%s by category/preset", (tab, expected) => {
    expect(titles(tab)).toEqual(expected);
  });
});

describe("taskStatus / toTaskViews", () => {
  it("DONE state wins, past due and open is OVERDUE, otherwise TODO", () => {
    expect(taskStatus(views[3], "2026-10-06")).toBe("DONE");
    expect(taskStatus(views[0], "2026-10-07")).toBe("OVERDUE");
    expect(taskStatus(views[0], "2026-10-06")).toBe("TODO");
  });

  it("a one-off task completed through completedAt counts as done", () => {
    const item = makeItem({ kind: "TASK", preset: "PERSONAL", category: "OTHER", completedAt: "2026-10-06T01:00:00.000Z", start: "2026-10-01" });
    const [v] = toTaskViews([{ item, occurrence: occurrenceOf(item) }], []);
    expect(v.done).toBe(true);
  });

  it("due is the occurrence date", () => {
    expect(views[1].due).toBe("2026-10-07");
  });
});

describe("dueLabel", () => {
  const today = "2026-10-06";
  it.each([
    ["2026-10-06", "Hôm nay"],
    ["2026-10-07", "Ngày mai"],
    ["2026-10-10", "Thứ 7, 10/10"],
    ["2026-10-11", "Chủ nhật, 11/10"],
    ["2026-10-19", "19/10/2026"],
    ["2026-10-04", "Quá hạn 2 ngày"],
    ["2026-10-05", "Quá hạn 1 ngày"],
  ])("%s → %s", (due, label) => {
    expect(dueLabel(due, today)).toBe(label);
  });

  it("no due date", () => {
    expect(dueLabel(null, today)).toBe("Không có hạn");
  });
});
