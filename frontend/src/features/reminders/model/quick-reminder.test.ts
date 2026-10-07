import { describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { itemSchema } from "@/core/model/item";
import { formToItem } from "@/features/items/model/form-to-item";
import { parseQuickReminder } from "./quick-reminder";

describe("parseQuickReminder", () => {
  it("uses the raw text as title with the chosen time and repeat (no magic parsing)", () => {
    const v = parseQuickReminder("  Gọi điện cho bà lúc 9h  ", "2026-10-06T15:20", { time: "20:00", repeat: { kind: "DAILY" } });
    expect(v).toMatchObject({
      kind: "REMINDER",
      preset: "REMEMBER",
      title: "Gọi điện cho bà lúc 9h",
      date: "2026-10-06",
      startTime: "20:00",
      repeat: { kind: "DAILY" },
      createReminder: true,
      reminderOffsets: [0],
      channels: ["IN_APP"],
    });
  });

  it("defaults to the next full hour today, rolling over midnight", () => {
    expect(parseQuickReminder("Tưới cây", "2026-10-06T15:20")).toMatchObject({ date: "2026-10-06", startTime: "16:00", repeat: { kind: "NONE" } });
    expect(parseQuickReminder("Tưới cây", "2026-10-06T23:40")).toMatchObject({ date: "2026-10-07", startTime: "00:00" });
  });

  it("a chosen time already past today moves to tomorrow for one-off reminders", () => {
    expect(parseQuickReminder("Khóa cửa", "2026-10-06T21:00", { time: "20:00" })).toMatchObject({ date: "2026-10-07" });
    expect(parseQuickReminder("Khóa cửa", "2026-10-06T21:00", { time: "20:00", date: "2026-10-06" })).toMatchObject({ date: "2026-10-06" });
  });

  it("produces a valid item through formToItem", () => {
    const v = parseQuickReminder("Gọi điện cho bà", "2026-10-06T15:20", { time: "20:00", repeat: { kind: "DAILY" } });
    const { item, rule } = formToItem(v, { spaceId: newId(), actorId: newId(), timeZone: "Asia/Ho_Chi_Minh" });
    expect(itemSchema.safeParse(item).success).toBe(true);
    expect(item.schedule).toMatchObject({ start: "2026-10-06T20:00", rrule: "FREQ=DAILY" });
    expect(rule?.offsetsMinutes).toEqual([0]);
  });
});
