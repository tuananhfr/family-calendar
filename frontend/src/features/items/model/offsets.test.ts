import { describe, expect, it } from "vitest";
import { OFFSET_CHOICES, offsetChoicesFor, offsetLabel } from "./offsets";

describe("offsetLabel", () => {
  it("names offsets in the largest whole unit", () => {
    expect(offsetLabel(0, false)).toBe("Đúng giờ");
    expect(offsetLabel(0, true)).toBe("Trong ngày");
    expect(offsetLabel(10, false)).toBe("10 phút trước");
    expect(offsetLabel(90, false)).toBe("90 phút trước");
    expect(offsetLabel(120, false)).toBe("2 giờ trước");
    expect(offsetLabel(1440, false)).toBe("1 ngày trước");
    expect(offsetLabel(10080, false)).toBe("1 tuần trước");
  });
});

describe("offsetChoicesFor", () => {
  it("all-day items only get day-sized offsets", () => {
    expect(offsetChoicesFor(true).every((m) => m % 1440 === 0)).toBe(true);
    expect(offsetChoicesFor(false)).toEqual(OFFSET_CHOICES);
  });
  it("keeps an unusual stored offset selectable so editing never drops it", () => {
    expect(offsetChoicesFor(false, 45)).toContain(45);
    expect(offsetChoicesFor(false, 45)).toEqual([...offsetChoicesFor(false, 45)].sort((a, b) => a - b));
  });
});
