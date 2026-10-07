import { describe, expect, it } from "vitest";
import { formatDateVi, formatWhen } from "./occurrence-label";

describe("formatDateVi", () => {
  it("writes the weekday and dd/mm/yyyy", () => {
    expect(formatDateVi("2026-10-06")).toBe("Thứ 3, 06/10/2026");
    expect(formatDateVi("2026-10-11")).toBe("Chủ nhật, 11/10/2026");
  });
});

describe("formatWhen", () => {
  it("timed occurrences show a range on one day", () => {
    expect(formatWhen({ start: "2026-10-06T08:00", end: "2026-10-06T09:30", allDay: false })).toBe("Thứ 3, 06/10/2026 · 08:00 – 09:30");
    expect(formatWhen({ start: "2026-10-06T07:00", allDay: false })).toBe("Thứ 3, 06/10/2026 · 07:00");
  });
  it("all-day spans list both days", () => {
    expect(formatWhen({ start: "2026-10-06", allDay: true })).toBe("Thứ 3, 06/10/2026 · Cả ngày");
    expect(formatWhen({ start: "2026-10-06", end: "2026-10-08", allDay: true })).toBe("Thứ 3, 06/10/2026 – Thứ 5, 08/10/2026");
  });
  it("timed events past midnight show the end day", () => {
    expect(formatWhen({ start: "2026-10-06T22:00", end: "2026-10-07T01:00", allDay: false })).toBe("Thứ 3, 06/10/2026 · 22:00 – Thứ 4, 07/10/2026 01:00");
  });
});
