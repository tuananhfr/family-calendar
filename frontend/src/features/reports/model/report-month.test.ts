import { describe, expect, it } from "vitest";
import { accessContextFor } from "@/core/access/evaluate";
import type { Item } from "@/core/model/item";
import type { LocalDataView } from "@/core/repo/data-view";
import { makeItem, makeMember, makeRule, makeState } from "@/core/test-support/items";
import { baseFields } from "@/core/test-support/records";
import { habitRates } from "./habits";
import { reportForMonth } from "./report-month";
import { familySuggestions } from "./suggestions";

const me = "7d1f2c3a-1111-4a2b-8c3d-0000000000aa";
const bo = makeMember("Bố", { linkedActorId: me });
const an = makeMember("Bé An", { profile: "CHILD" });
const ba = makeMember("Bà", { profile: "SENIOR" });
const gone = makeMember("Cũ", { status: "ARCHIVED" });
const ctx = accessContextFor("OWNER", { actorId: me, representedMemberIds: [bo.id], representedProfiles: ["PARENT"], spaceKind: "FAMILY" });

const TZ = "Asia/Ho_Chi_Minh";
const at = (start: string, end?: string, rrule?: string) => ({ schedule: { allDay: start.length === 10, start, ...(end ? { end } : {}), timeZone: TZ, ...(rrule ? { rrule } : {}) } });

const habit = makeItem({ kind: "REMINDER", preset: "REMEMBER", title: "Uống nước", ...at("2026-09-01T06:00", undefined, "FREQ=DAILY"), createdAt: "2026-08-20T00:00:00.000Z" });
const dinner = makeItem({ title: "Ăn tối nhà ngoại", category: "FAMILY", memberIds: [bo.id, an.id], ...at("2026-09-05T18:00", "2026-09-05T20:00") });
const study = makeItem({ title: "Học thêm Toán", category: "STUDY", memberIds: [an.id], ...at("2026-09-10T08:00", "2026-09-10T09:30") });
const football = makeItem({ title: "Đá bóng", category: "SPORT", memberIds: [an.id], ...at("2026-09-05T16:00", "2026-09-05T17:00", "FREQ=WEEKLY;BYDAY=SA") });
const meeting = makeItem({ title: "Họp phụ huynh", category: "FAMILY", ...at("2026-09-20") });
const august = makeItem({ title: "Đi biển", category: "FAMILY", ...at("2026-08-15") });
const othersPrivate = makeItem({ ...baseFields({ sharingScope: "PRIVATE" }), title: "Hẹn riêng", category: "FAMILY", memberIds: [ba.id], ...at("2026-09-15T10:00", "2026-09-15T11:00") });
const taskDone = makeItem({ kind: "TASK", preset: "TODO" as Item["preset"], title: "Nộp học phí", ...at("2026-09-08"), completedAt: "2026-09-08T03:00:00.000Z" });
const taskOpen = makeItem({ kind: "TASK", preset: "TODO" as Item["preset"], title: "Sửa vòi nước", ...at("2026-09-09") });

const days = Array.from({ length: 26 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}T06:00`);

function data(): LocalDataView {
  return {
    space: {} as LocalDataView["space"],
    members: [bo, an, ba, gone],
    items: [habit, dinner, study, football, meeting, august, othersPrivate, taskDone, taskOpen],
    exceptions: [],
    states: days.map((d) => makeState(habit, d, "DONE", { actedByActorId: me, actedAt: `${d.slice(0, 10)}T00:00:00.000Z` })),
    rules: [makeRule(habit, { offsetsMinutes: [0] }), makeRule(dinner, { offsetsMinutes: [60, 10] }), makeRule(othersPrivate, { offsetsMinutes: [0] })],
    files: [],
    financeTxns: [],
    healthNotes: [],
  };
}

describe("reportForMonth", () => {
  const r = reportForMonth(data(), "2026-09", ctx, { today: "2026-09-30" });

  it("KPI blocks", () => {
    // 1 dinner + 1 study + 4 Saturdays of football + 1 meeting; August had 1 event.
    expect(r.events).toEqual({ count: 7, deltaPercent: 600 });
    expect(r.tasks).toEqual({ done: 1, total: 2, percent: 50 });
    // 30 habit days × 1 offset + 1 dinner × 2 offsets; the other actor's PRIVATE rule is not counted.
    expect(r.reminders).toEqual({ count: 32 });
    // Bố and Bé An have events; Bà only appears in someone else's PRIVATE item; archived members don't count.
    expect(r.members).toEqual({ active: 2, total: 3 });
  });

  it("splits events by category", () => {
    expect(r.byCategory).toEqual([
      { category: "SPORT", count: 4, percent: 57.1 },
      { category: "FAMILY", count: 2, percent: 28.6 },
      { category: "STUDY", count: 1, percent: 14.3 },
    ]);
  });

  it("counts an event of two members for both", () => {
    expect(r.memberTime).toEqual([
      { memberId: bo.id, displayName: "Bố", hours: { FAMILY: 2 }, totalHours: 2 },
      { memberId: an.id, displayName: "Bé An", hours: { FAMILY: 2, SPORT: 4, STUDY: 1.5 }, totalHours: 7.5 },
    ]);
  });

  it("habits, top events and last activity", () => {
    expect(r.habits).toEqual([{ itemId: habit.id, title: "Uống nước", done: 26, total: 30, percent: 87 }]);
    expect(r.topEvents[0]).toEqual({ title: "Đá bóng", count: 4 });
    expect(r.topEvents).toHaveLength(4);
    expect(r.daysSinceActivity).toBe(4);
  });

  it("another actor's PRIVATE data never reaches the numbers", () => {
    const without = { ...data(), items: data().items.filter((i) => i.id !== othersPrivate.id) };
    expect(reportForMonth(without, "2026-09", ctx, { today: "2026-09-30" })).toEqual(r);
  });

  it("a viewer who may not see health items gets no health counts", () => {
    const pill = makeItem({ ...baseFields({ dataClass: "SENSITIVE" }), kind: "REMINDER", preset: "MEDICATION", category: "HEALTH", title: "Thuốc", memberIds: [ba.id], ...at("2026-09-01T07:00", undefined, "FREQ=DAILY") });
    const child = accessContextFor("MEMBER", { actorId: "7d1f2c3a-1111-4a2b-8c3d-0000000000cc", representedMemberIds: [an.id], representedProfiles: ["CHILD"], spaceKind: "FAMILY" });
    const withPill = { ...data(), items: [...data().items, pill], rules: [...data().rules, makeRule(pill, { offsetsMinutes: [0] })] };
    const seen = reportForMonth(withPill, "2026-09", child, { today: "2026-09-30" });
    expect(seen.habits.map((h) => h.title)).not.toContain("Thuốc");
    expect(seen.reminders.count).toBe(32);
  });
});

describe("habitRates", () => {
  it("26 of 30 days → 87%", () => {
    const states = days.map((d) => makeState(habit, d, "DONE"));
    expect(habitRates([habit], states, "2026-09")).toEqual([{ itemId: habit.id, title: "Uống nước", done: 26, total: 30, percent: 87 }]);
  });

  it("days after today are not counted as missed", () => {
    const states = days.slice(0, 10).map((d) => makeState(habit, d, "DONE"));
    expect(habitRates([habit], states, "2026-09", { today: "2026-09-10" })[0]).toMatchObject({ done: 10, total: 10, percent: 100 });
  });

  it("only daily reminders and tasks are habits", () => {
    expect(habitRates([football, dinner], [], "2026-09")).toEqual([]);
  });
});

describe("familySuggestions", () => {
  const base = reportForMonth(data(), "2026-09", ctx, { today: "2026-09-30" });

  it("no suggestion when everything is fine", () => {
    expect(familySuggestions(base)).toEqual([]);
  });

  it("fixed rules, at most four", () => {
    const weak = {
      ...base,
      habits: [
        { itemId: "a", title: "Đọc sách", done: 10, total: 30, percent: 33 },
        { itemId: "b", title: "Tập thể dục", done: 18, total: 30, percent: 60 },
      ],
      daysSinceActivity: null,
      tasks: { done: 1, total: 5, percent: 20 },
      byCategory: [],
    };
    expect(familySuggestions(weak)).toEqual([
      'Duy trì thói quen "Đọc sách" (33% tháng này)',
      'Duy trì thói quen "Tập thể dục" (60% tháng này)',
      "Tăng hoạt động ngoài trời cùng cả nhà",
      "Chia nhỏ việc cần làm để dễ hoàn thành hơn",
    ]);
    expect(familySuggestions({ ...base, daysSinceActivity: 14 })).toEqual(["Tăng hoạt động ngoài trời cùng cả nhà"]);
  });
});
