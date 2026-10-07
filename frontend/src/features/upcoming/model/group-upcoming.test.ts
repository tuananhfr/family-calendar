import { describe, expect, it } from "vitest";
import type { Item } from "@/core/model/item";
import { makeItem, makeState, occurrenceOf } from "@/core/test-support/items";
import { firstOpenPerItem, groupUpcoming, isUpcomingItem, toUpcomingEntries, upcomingKindOf } from "./group-upcoming";

const TODAY = "2026-10-06";

function doc(start: string, title = start): Item {
  return makeItem({ kind: "REMINDER", preset: "DOCUMENT", category: "DOCUMENT", title, start });
}

describe("groupUpcoming", () => {
  const yesterdayOpen = doc("2026-10-05", "Hôm qua chưa xong");
  const yesterdayDone = doc("2026-10-05", "Hôm qua đã xong");
  const today = doc("2026-10-06", "Hôm nay");
  const in7 = doc("2026-10-13", "Còn 7 ngày");
  const in8 = doc("2026-10-14", "Còn 8 ngày");
  const in30 = doc("2026-11-05", "Còn 30 ngày");
  const passport = doc("2027-08-31", "Hộ chiếu Mẹ");
  const items = [passport, in30, in8, in7, today, yesterdayDone, yesterdayOpen];
  const entries = toUpcomingEntries(
    items.map((item) => ({ item, occurrence: occurrenceOf(item) })),
    [makeState(yesterdayDone, "2026-10-05", "DONE")],
  );
  const groups = groupUpcoming(entries, TODAY);
  const t = (list: typeof groups.overdue) => list.map((e) => e.item.title);

  it("an unfinished deadline from yesterday is overdue; a finished one is hidden", () => {
    expect(t(groups.overdue)).toEqual(["Hôm qua chưa xong"]);
    expect(Object.values(groups).flat().map((e) => e.item.title)).not.toContain("Hôm qua đã xong");
  });

  it("today through today+7 are '7 ngày tới', up to +30 are '30 ngày tới', the rest 'Sau đó'", () => {
    expect(t(groups.next7)).toEqual(["Hôm nay", "Còn 7 ngày"]);
    expect(t(groups.next30)).toEqual(["Còn 8 ngày", "Còn 30 ngày"]);
    expect(t(groups.later)).toEqual(["Hộ chiếu Mẹ"]);
  });

  it("entries carry days left", () => {
    expect(groups.next7[1].daysLeft).toBe(7);
    expect(groups.overdue[0].daysLeft).toBe(-1);
  });
});

describe("isUpcomingItem", () => {
  it("documents, payments, appointments and tasks are deadlines; plain events and medication are not", () => {
    expect(isUpcomingItem(makeItem({ kind: "REMINDER", preset: "DOCUMENT", category: "DOCUMENT" }))).toBe(true);
    expect(isUpcomingItem(makeItem({ kind: "REMINDER", preset: "PAYMENT", category: "FINANCE" }))).toBe(true);
    expect(isUpcomingItem(makeItem({ kind: "EVENT", preset: "APPOINTMENT", category: "HEALTH" }))).toBe(true);
    expect(isUpcomingItem(makeItem({ kind: "TASK", preset: "PERSONAL", category: "OTHER" }))).toBe(true);
    expect(isUpcomingItem(makeItem({ kind: "EVENT", preset: "EVENT", category: "FAMILY" }))).toBe(false);
    expect(isUpcomingItem(makeItem({ kind: "REMINDER", preset: "MEDICATION", category: "HEALTH" }))).toBe(false);
  });

  it("toUpcomingEntries drops non-deadline items", () => {
    const ev = makeItem();
    expect(toUpcomingEntries([{ item: ev, occurrence: occurrenceOf(ev) }], [])).toEqual([]);
  });
});

describe("firstOpenPerItem", () => {
  const bill = makeItem({ kind: "REMINDER", preset: "PAYMENT", category: "FINANCE", title: "Tiền điện", start: "2026-09-05T09:00", schedule: { allDay: false, start: "2026-09-05T09:00", rrule: "FREQ=MONTHLY", timeZone: "Asia/Ho_Chi_Minh" } });
  const starts = ["2026-08-05T09:00", "2026-09-05T09:00", "2026-10-05T09:00", "2026-11-05T09:00", "2026-12-05T09:00"];
  const entries = toUpcomingEntries(
    starts.map((s) => ({ item: bill, occurrence: occurrenceOf(bill, s) })),
    [makeState(bill, "2026-08-05T09:00", "DONE")],
  );

  it("keeps one row per item at its earliest open occurrence and counts the other overdue ones", () => {
    const rows = firstOpenPerItem(entries, TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0].due).toBe("2026-09-05");
    expect(rows[0].overdueCount).toBe(2);
  });

  it("an item with nothing overdue shows its next occurrence only", () => {
    const later = entries.filter((e) => e.due >= TODAY);
    const rows = firstOpenPerItem(later, TODAY);
    expect(rows.map((r) => r.due)).toEqual(["2026-11-05"]);
    expect(rows[0].overdueCount).toBe(0);
  });

  it("a fully done item disappears", () => {
    const one = doc("2026-10-20");
    const done = toUpcomingEntries([{ item: one, occurrence: occurrenceOf(one) }], [makeState(one, "2026-10-20", "DONE")]);
    expect(firstOpenPerItem(done, TODAY)).toEqual([]);
  });
});

describe("upcomingKindOf", () => {
  it("maps presets to the page tabs", () => {
    expect(upcomingKindOf(doc("2026-10-20"))).toBe("DOCUMENT");
    expect(upcomingKindOf(makeItem({ kind: "REMINDER", preset: "PAYMENT", category: "FINANCE" }))).toBe("PAYMENT");
    expect(upcomingKindOf(makeItem({ kind: "EVENT", preset: "APPOINTMENT", category: "HEALTH" }))).toBe("APPOINTMENT");
    expect(upcomingKindOf(makeItem({ kind: "TASK", preset: "PAYMENT", category: "FINANCE" }))).toBe("TASK");
  });
});
