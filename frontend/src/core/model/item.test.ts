import { describe, expect, it } from "vitest";
import { newId } from "../ids";
import type { BaseRecord } from "../sync/resource-types";
import { defaultsForPreset, itemSchema, itemSchemaForSpace, type Item } from "./item";

function validItem(overrides: Partial<Item> = {}): Item {
  return {
    id: newId(),
    spaceId: newId(),
    createdByActorId: newId(),
    dataClass: "NORMAL",
    sharingScope: "FAMILY_ALL",
    revision: null,
    createdAt: "2026-10-06T00:00:00.000Z",
    updatedAt: "2026-10-06T00:00:00.000Z",
    deletedAt: null,
    syncState: "LOCAL",
    kind: "EVENT",
    preset: "APPOINTMENT",
    title: "🎂 Sinh nhật Bà Nội",
    schedule: { allDay: false, start: "2026-10-06T09:00", end: "2026-10-06T10:00", timeZone: "Asia/Ho_Chi_Minh" },
    memberIds: [],
    category: "FAMILY",
    priority: "MEDIUM",
    attachments: [],
    showOnCalendar: true,
    calendarSystem: "SOLAR",
    ...overrides,
  };
}

function codes(input: unknown): string[] {
  const r = itemSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe("itemSchema", () => {
  it("produces a type the repository accepts as a BaseRecord", () => {
    const asBase: BaseRecord = validItem();
    expect(asBase.syncState).toBe("LOCAL");
  });

  it("accepts a valid item and trims the title", () => {
    const parsed = itemSchema.parse(validItem({ title: "  Họp phụ huynh  " }));
    expect(parsed.title).toBe("Họp phụ huynh");
  });

  it("rejects empty or whitespace-only titles", () => {
    expect(codes(validItem({ title: "" }))).toContain("TITLE_REQUIRED");
    expect(codes(validItem({ title: "   " }))).toContain("TITLE_REQUIRED");
  });

  it("accepts 200 characters and rejects 201", () => {
    expect(itemSchema.safeParse(validItem({ title: "a".repeat(200) })).success).toBe(true);
    expect(codes(validItem({ title: "a".repeat(201) }))).toContain("TITLE_TOO_LONG");
  });

  it("rejects negative or fractional amounts", () => {
    const payment = { kind: "REMINDER" as const, preset: "PAYMENT" as const, category: "FINANCE" as const };
    expect(itemSchema.safeParse(validItem({ ...payment, amount: 1_500_000 })).success).toBe(true);
    expect(codes(validItem({ ...payment, amount: -1 }))).toContain("AMOUNT_NEGATIVE");
    expect(codes(validItem({ ...payment, amount: 10.5 }))).toContain("AMOUNT_NOT_INTEGER");
  });

  it("rejects duplicate memberIds", () => {
    const m = newId();
    expect(codes(validItem({ memberIds: [m, m] }))).toContain("MEMBERS_DUPLICATE");
  });

  it("rejects a preset that does not belong to the kind", () => {
    expect(codes(validItem({ kind: "TASK", preset: "MEDICATION" }))).toContain("PRESET_NOT_IN_KIND");
    expect(codes(validItem({ kind: "EVENT", preset: "SHOPPING" }))).toContain("PRESET_NOT_IN_KIND");
  });

  it("checks that schedule values match allDay and that end is not before start", () => {
    expect(codes(validItem({ schedule: { allDay: true, start: "2026-10-06T09:00", timeZone: "Asia/Ho_Chi_Minh" } }))).toContain(
      "SCHEDULE_SHAPE",
    );
    expect(
      codes(validItem({ schedule: { allDay: false, start: "2026-10-06T09:00", end: "2026-10-06T08:00", timeZone: "Asia/Ho_Chi_Minh" } })),
    ).toContain("END_BEFORE_START");
    expect(codes(validItem({ schedule: { allDay: true, start: "2026-10-06", timeZone: "Mars/Olympus" } }))).toContain(
      "INVALID_TIME_ZONE",
    );
  });

  it("requires calendarSystem LUNAR to come with a lunar rule and validates it", () => {
    expect(codes(validItem({ calendarSystem: "LUNAR" }))).toContain("LUNAR_RULE_REQUIRED");
    const lunar = validItem({
      kind: "EVENT",
      preset: "DEATH_ANNIVERSARY",
      category: "SPECIAL",
      calendarSystem: "LUNAR",
      schedule: {
        allDay: true,
        start: "2026-01-01",
        timeZone: "Asia/Ho_Chi_Minh",
        lunarRule: { freq: "YEARLY", day: 10, month: 3, includeLeap: false },
      },
    });
    expect(itemSchema.safeParse(lunar).success).toBe(true);
    expect(
      codes({ ...lunar, schedule: { ...lunar.schedule, lunarRule: { freq: "YEARLY", day: 31, month: 3, includeLeap: false } } }),
    ).toContain("LUNAR_RULE_INVALID");
  });

  it("rejects an unparsable RRULE", () => {
    expect(codes(validItem({ schedule: { allDay: true, start: "2026-10-06", timeZone: "Asia/Ho_Chi_Minh", rrule: "FREQ=NEVER" } }))).toContain(
      "RRULE_INVALID",
    );
  });

  it("leaves scope-vs-space-kind checks to itemSchemaForSpace, which needs the Space", () => {
    expect(itemSchema.safeParse(validItem({ sharingScope: "GROUP_MEMBERS" })).success).toBe(true);
    expect(itemSchemaForSpace("FAMILY").safeParse(validItem({ sharingScope: "GROUP_MEMBERS" })).success).toBe(false);
    expect(itemSchemaForSpace("GROUP").safeParse(validItem({ sharingScope: "PARENTS_SENIORS" })).success).toBe(false);
    expect(itemSchemaForSpace("GROUP").safeParse(validItem({ sharingScope: "GROUP_MANAGERS" })).success).toBe(true);
  });
});

describe("defaultsForPreset", () => {
  it("MEDICATION is sensitive and private by default", () => {
    expect(defaultsForPreset("REMINDER", "MEDICATION")).toEqual({ category: "HEALTH", dataClass: "SENSITIVE", sharingScope: "PRIVATE" });
  });

  it("TIMETABLE is a normal family-wide study event", () => {
    expect(defaultsForPreset("EVENT", "TIMETABLE")).toEqual({ category: "STUDY", dataClass: "NORMAL", sharingScope: "FAMILY_ALL" });
  });

  it("PAYMENT and DOCUMENT are private", () => {
    expect(defaultsForPreset("REMINDER", "PAYMENT")).toMatchObject({ category: "FINANCE", dataClass: "PRIVATE", sharingScope: "PRIVATE" });
    expect(defaultsForPreset("REMINDER", "DOCUMENT")).toMatchObject({ dataClass: "PRIVATE", sharingScope: "PRIVATE" });
  });

  it("special days use the SPECIAL category", () => {
    expect(defaultsForPreset("EVENT", "BIRTHDAY").category).toBe("SPECIAL");
    expect(defaultsForPreset("EVENT", "DEATH_ANNIVERSARY").category).toBe("SPECIAL");
  });

  it("maps family-wide defaults to group scopes inside a GROUP space", () => {
    expect(defaultsForPreset("TASK", "GROUP", "GROUP").sharingScope).toBe("GROUP_MEMBERS");
    expect(defaultsForPreset("REMINDER", "MEDICATION", "GROUP").sharingScope).toBe("PRIVATE");
  });

  it("throws for a preset outside the kind", () => {
    expect(() => defaultsForPreset("TASK", "MEDICATION")).toThrow();
  });
});
