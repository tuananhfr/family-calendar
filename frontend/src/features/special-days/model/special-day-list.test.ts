import { describe, expect, it } from "vitest";
import { occurrenceKey } from "@/core/recurrence/occurrence-key";
import { makeItem } from "@/core/test-support/items";
import { specialDayList, specialDayOccurrenceKey, yearsOn } from "./special-day-list";

const TODAY = "2026-10-06";
const yearly = (title: string, start: string, preset = "BIRTHDAY") =>
  makeItem({ kind: "EVENT", preset: preset as never, category: "SPECIAL", title, schedule: { allDay: start.length === 10, start, rrule: "FREQ=YEARLY", timeZone: "Asia/Ho_Chi_Minh" } });

describe("specialDayList", () => {
  const bà = yearly("Sinh nhật Bà", "1950-10-06");
  const bố = yearly("Sinh nhật Bố", "1980-12-01");
  const cưới = yearly("Kỷ niệm ngày cưới", "2010-10-20", "ANNIVERSARY");
  const past = makeItem({ kind: "EVENT", preset: "SPECIAL_DAY", category: "SPECIAL", title: "Lễ tốt nghiệp", start: "2026-06-01" });
  const party = makeItem({ kind: "EVENT", preset: "EVENT", category: "FAMILY", title: "Tiệc" });

  it("sorts upcoming days by countdown and keeps one-off days that already passed apart", () => {
    const list = specialDayList([bố, past, cưới, party, bà], TODAY);
    expect(list.upcoming.map((r) => r.item.title)).toEqual(["Sinh nhật Bà", "Kỷ niệm ngày cưới", "Sinh nhật Bố"]);
    expect(list.upcoming[0].countdown.daysLeft).toBe(0);
    expect(list.past.map((i) => i.title)).toEqual(["Lễ tốt nghiệp"]);
  });
});

describe("specialDayOccurrenceKey", () => {
  it("all-day uses the date, a timed day keeps its wall-clock time", () => {
    const allDay = yearly("A", "1950-10-06");
    expect(specialDayOccurrenceKey(allDay, "2027-10-06")).toBe(occurrenceKey(allDay.id, "2027-10-06"));
    const timed = yearly("B", "2020-10-06T18:30");
    expect(specialDayOccurrenceKey(timed, "2027-10-06")).toBe(occurrenceKey(timed.id, "2027-10-06T18:30"));
  });
});

describe("yearsOn", () => {
  it("counts whole years for birthdays and anniversaries only", () => {
    expect(yearsOn(yearly("Bà", "1950-10-06"), "2026-10-06")).toBe(76);
    expect(yearsOn(yearly("Cưới", "2010-10-20", "ANNIVERSARY"), "2026-10-20")).toBe(16);
    expect(yearsOn(yearly("Giỗ", "2000-04-16", "DEATH_ANNIVERSARY"), "2027-04-16")).toBeUndefined();
  });

  it("a day entered for this year has no count yet", () => {
    expect(yearsOn(yearly("Bé", "2026-12-01"), "2026-12-01")).toBeUndefined();
  });
});
