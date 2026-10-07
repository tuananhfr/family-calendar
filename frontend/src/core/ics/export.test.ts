import { describe, expect, it } from "vitest";
import type { ItemExceptionRecord } from "../model/occurrence";
import { occurrenceKey } from "../recurrence/occurrence-key";
import { makeItem } from "../test-support/items";
import { baseFields } from "../test-support/records";
import { exportIcs, foldLine } from "./export";

const now = new Date("2026-10-07T00:00:00.000Z");

function events(ics: string): string[] {
  return ics.split("BEGIN:VEVENT").slice(1).map((e) => e.split("END:VEVENT")[0]);
}

describe("exportIcs", () => {
  it("wraps events in a VCALENDAR with CRLF line endings", () => {
    const ics = exportIcs([makeItem({ title: "Họp phụ huynh" })], [], { now });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("SUMMARY:Họp phụ huynh\r\n");
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("all-day uses DTSTART;VALUE=DATE and an exclusive DTEND", () => {
    const [e] = events(exportIcs([makeItem({ title: "Đi Đà Lạt", start: "2026-10-10", end: "2026-10-12" })], [], { now }));
    expect(e).toContain("DTSTART;VALUE=DATE:20261010\r\n");
    expect(e).toContain("DTEND;VALUE=DATE:20261013\r\n");
  });

  it("timed events carry the IANA TZID and keep the RRULE", () => {
    const item = makeItem({
      title: "Đưa bé đi học",
      schedule: { allDay: false, start: "2026-10-05T07:00", end: "2026-10-05T07:30", timeZone: "Asia/Ho_Chi_Minh", rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR" },
    });
    const [e] = events(exportIcs([item], [], { now }));
    expect(e).toContain("DTSTART;TZID=Asia/Ho_Chi_Minh:20261005T070000\r\n");
    expect(e).toContain("DTEND;TZID=Asia/Ho_Chi_Minh:20261005T073000\r\n");
    expect(e).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\n");
    expect(e).toContain(`UID:${item.id}@lich-gia-dinh\r\n`);
  });

  it("cancelled occurrences become EXDATE, moved ones a RECURRENCE-ID override", () => {
    const item = makeItem({
      title: "Học bơi",
      schedule: { allDay: false, start: "2026-10-05T17:00", timeZone: "Asia/Ho_Chi_Minh", rrule: "FREQ=WEEKLY;BYDAY=MO" },
    });
    const ex = (start: string, kind: "CANCEL" | "OVERRIDE", override?: ItemExceptionRecord["override"]) =>
      ({ ...baseFields({ spaceId: item.spaceId }), itemId: item.id, occurrenceKey: occurrenceKey(item.id, start), kind, override }) as ItemExceptionRecord;
    const ics = exportIcs([item], [ex("2026-10-12T17:00", "CANCEL"), ex("2026-10-19T17:00", "OVERRIDE", { start: "2026-10-20T17:00", title: "Học bơi (bù)" })], { now });
    const [main, moved] = events(ics);
    expect(main).toContain("EXDATE;TZID=Asia/Ho_Chi_Minh:20261012T170000\r\n");
    expect(moved).toContain("RECURRENCE-ID;TZID=Asia/Ho_Chi_Minh:20261019T170000\r\n");
    expect(moved).toContain("DTSTART;TZID=Asia/Ho_Chi_Minh:20261020T170000\r\n");
    expect(moved).toContain("SUMMARY:Học bơi (bù)\r\n");
  });

  it("lunar repeats are written as computed dates for the next 3 years (ICS has no lunar calendar)", () => {
    const item = makeItem({
      title: "Giỗ ông nội",
      kind: "EVENT",
      preset: "DEATH_ANNIVERSARY",
      calendarSystem: "LUNAR",
      schedule: { allDay: true, start: "2026-04-26", timeZone: "Asia/Ho_Chi_Minh", lunarRule: { freq: "YEARLY", day: 10, month: 3, includeLeap: false } },
    });
    const evs = events(exportIcs([item], [], { now }));
    expect(evs).toHaveLength(3);
    expect(evs.every((e) => !e.includes("RRULE"))).toBe(true);
    // 10/3 âm lịch: 2027-04-16, 2028-04-04, 2029-04-23.
    expect(evs.map((e) => /DTSTART;VALUE=DATE:(\d+)/.exec(e)?.[1])).toEqual(["20270416", "20280404", "20290423"]);
    expect(new Set(evs.map((e) => /UID:(.*)\r\n/.exec(e)?.[1])).size).toBe(3);
  });

  it("leaves PRIVATE and SENSITIVE items out by default", () => {
    const items = [
      makeItem({ title: "Công khai" }),
      makeItem({ ...baseFields({ sharingScope: "PRIVATE" }), title: "Riêng tư" }),
      makeItem({ ...baseFields({ dataClass: "PRIVATE" }), title: "Lớp riêng tư" }),
      makeItem({ ...baseFields({ dataClass: "SENSITIVE" }), kind: "REMINDER", preset: "MEDICATION", category: "HEALTH", title: "Thuốc huyết áp" }),
      makeItem({ ...baseFields({ deletedAt: "2026-10-01T00:00:00.000Z" }), title: "Đã xoá" }),
    ];
    const ics = exportIcs(items, [], { now });
    expect(events(ics)).toHaveLength(1);
    expect(ics).not.toMatch(/Riêng tư|Lớp riêng tư|Thuốc|Đã xoá/);
    expect(events(exportIcs(items, [], { now, includePrivate: true }))).toHaveLength(3);
    expect(events(exportIcs(items, [], { now, includePrivate: true, includeSensitive: true }))).toHaveLength(4);
  });

  it("escapes text and folds long lines at 75 octets", () => {
    const ics = exportIcs([makeItem({ title: "Mua sữa; bánh, trứng\\", note: "Dòng 1\nDòng 2" })], [], { now });
    expect(ics).toContain("SUMMARY:Mua sữa\\; bánh\\, trứng\\\\\r\n");
    expect(ics).toContain("DESCRIPTION:Dòng 1\\nDòng 2\r\n");
    const folded = foldLine(`SUMMARY:${"Đặt lịch khám răng cho cả nhà ".repeat(4)}`);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"Đặt lịch khám răng cho cả nhà ".repeat(4)}`);
  });
});
