import { describe, expect, it } from "vitest";
import { accessContextFor, hasLevel } from "@/core/access/evaluate";
import type { HealthMetric } from "@/core/model/health";
import type { Item } from "@/core/model/item";
import type { OccurrenceState } from "@/core/model/occurrence";
import { metricSeries, parseMetricValues, todayMedications, upcomingAppointments, vnDateTime } from "./health-view";

const item = (id: string, over: Partial<Item>) => ({ id, title: id, kind: "REMINDER", preset: "MEDICATION", category: "HEALTH", ...over }) as Item;
const entry = (it: Item, start: string, state?: Partial<OccurrenceState>) => ({
  item: it,
  occurrence: { itemId: it.id, occurrenceKey: `${it.id}@${start}`, start, allDay: false, overridden: false },
  state: state ? ({ occurrenceKey: `${it.id}@${start}`, ...state } as OccurrenceState) : undefined,
});

describe("health view", () => {
  it("lists today's doses with their status and leaves other reminders out", () => {
    const vitD = item("vitd", {});
    const rows = todayMedications(
      [
        entry(vitD, "2026-10-06T07:00", { status: "DONE" }),
        entry(item("iron", {}), "2026-10-06T08:00"),
        entry(item("calcium", {}), "2026-10-06T20:00"),
        entry(item("tomorrow", {}), "2026-10-07T07:00"),
        entry(item("bill", { preset: "PAYMENT", category: "FINANCE" }), "2026-10-06T08:00"),
      ],
      "2026-10-06",
      "2026-10-06T07:45",
    );
    expect(rows.map((r) => [r.item.id, r.status])).toEqual([
      ["vitd", "TAKEN"],
      ["iron", "DUE_SOON"],
      ["calcium", "NOT_YET"],
    ]);
  });

  it("counts days to upcoming health events and drops past or cancelled ones", () => {
    const ev = (id: string) => item(id, { kind: "EVENT", preset: "APPOINTMENT" });
    const rows = upcomingAppointments(
      [entry(ev("past"), "2026-10-05T08:00"), entry(ev("soon"), "2026-10-10T08:30"), entry(ev("off"), "2026-10-12T08:00", { status: "SKIPPED" }), entry(item("med", {}), "2026-10-07T08:00")],
      "2026-10-06",
    );
    expect(rows.map((r) => [r.item.id, r.daysLeft])).toEqual([["soon", 4]]);
  });

  it("reads Vietnamese decimals and blood pressure pairs", () => {
    expect(parseMetricValues("6,5", "WEIGHT")).toEqual([6.5]);
    expect(parseMetricValues(" 120 / 80 ", "BLOOD_PRESSURE")).toEqual([120, 80]);
    expect(parseMetricValues("abc", "WEIGHT")[0]).toBeNaN();
    expect(parseMetricValues("", "HEART_RATE")[0]).toBeNaN();
  });

  it("builds a member's series oldest first", () => {
    const m = (id: string, at: string, memberId = "a") => ({ id, memberId, type: "WEIGHT", value: 6, measuredAt: at }) as HealthMetric;
    expect(metricSeries([m("2", "2026-10-02T08:00"), m("1", "2026-10-01T08:00"), m("x", "2026-10-03T08:00", "b")], "a", "WEIGHT").map((x) => x.id)).toEqual(["1", "2"]);
    expect(vnDateTime("2026-10-12T08:30")).toBe("12/10/2026 08:30");
    expect(vnDateTime("2026-10-12")).toBe("12/10/2026");
  });
});

describe("health access", () => {
  it("a guest or child role has no health view; adults do", () => {
    const ctx = (role: "GUEST" | "MEMBER" | "ADULT" | "GUARDIAN") => accessContextFor(role, { actorId: "a", spaceKind: "FAMILY", representedMemberIds: [], representedProfiles: [] });
    expect(hasLevel(ctx("GUEST"), "health", "VIEW")).toBe(false);
    expect(hasLevel(ctx("MEMBER"), "health", "VIEW")).toBe(false);
    expect(hasLevel(ctx("ADULT"), "health", "EDIT")).toBe(true);
    expect(hasLevel(ctx("GUARDIAN"), "health", "EDIT")).toBe(false);
  });
});
