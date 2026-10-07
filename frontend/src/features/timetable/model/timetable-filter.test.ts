import { describe, expect, it } from "vitest";
import { makeItem, occurrenceOf } from "@/core/test-support/items";
import { TIMETABLE_TEMPLATE_CSV, timetableEntries } from "./timetable-filter";
import { parseTimetableCsv } from "./parse-import";

const lesson = (title: string, category: "STUDY" | "ACTIVITY" | "SPORT", memberIds: string[]) => makeItem({ kind: "EVENT", preset: "TIMETABLE", category, title, memberIds });

describe("timetableEntries", () => {
  const toan = lesson("Toán", "STUDY", ["bin"]);
  const boi = lesson("Bơi", "ACTIVITY", ["bin"]);
  const ve = lesson("Vẽ", "SPORT", ["na"]);
  const party = makeItem({ title: "Tiệc", memberIds: ["bin"] });
  const entries = [toan, boi, ve, party].map((item) => ({
    item,
    occurrence: occurrenceOf(item),
  }));
  const titles = (tab: Parameters<typeof timetableEntries>[1], memberId?: string) => timetableEntries(entries, tab, memberId).map((e) => e.item.title);

  it("only timetable lessons, never other events", () => {
    expect(titles("WEEK")).toEqual(["Toán", "Bơi", "Vẽ"]);
  });

  it("Học tập is study; Ngoại khóa is everything else", () => {
    expect(titles("STUDY")).toEqual(["Toán"]);
    expect(titles("ACTIVITY")).toEqual(["Bơi", "Vẽ"]);
  });

  it("Theo thành viên keeps that member's lessons", () => {
    expect(titles("MEMBER", "na")).toEqual(["Vẽ"]);
    expect(titles("MEMBER")).toEqual([]);
  });
});

describe("TIMETABLE_TEMPLATE_CSV", () => {
  it("has every column the importer needs", () => {
    const res = parseTimetableCsv(TIMETABLE_TEMPLATE_CSV, {
      members: [{ id: "a", displayName: "Bin" }],
    });
    expect(res.errors).toEqual([]);
    expect(res.rows).toHaveLength(2);
  });
});
