import { describe, expect, it } from "vitest";
import { boardDateVi, longDateVi } from "./date-label";

describe("today date labels", () => {
  it("spells the weekday out as in the mockup", () => {
    expect(longDateVi("2026-10-06")).toBe("Thứ Ba, 6 tháng 10, 2026");
    expect(boardDateVi("2026-10-06")).toBe("Thứ Ba, 6/10/2026");
  });

  it("uses Chủ nhật for Sundays", () => {
    expect(longDateVi("2026-10-11")).toBe("Chủ nhật, 11 tháng 10, 2026");
  });
});
