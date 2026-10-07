import { describe, expect, it } from "vitest";
import { templateByKey } from "@/features/items";
import { durationLabel, templateReminderLabel, templateTimeLabel } from "./template-summary";

describe("durationLabel", () => {
  it.each([
    [30, "30 phút"],
    [60, "1 giờ"],
    [90, "1 giờ 30 phút"],
    [120, "2 giờ"],
  ])("%i → %s", (m, out) => expect(durationLabel(m)).toBe(out));
});

describe("template summaries", () => {
  it("timed template shows start time and length", () => {
    expect(templateTimeLabel(templateByKey("HEALTH_CHECKUP")!)).toBe("08:00 · 1 giờ");
  });

  it("all-day template says so", () => {
    expect(templateTimeLabel(templateByKey("BIRTHDAY")!)).toBe("Cả ngày");
  });

  it("reminders list months first, then days", () => {
    expect(templateReminderLabel(templateByKey("DOCUMENT_EXPIRY")!)).toBe("6 tháng trước, 3 tháng trước, 30 ngày trước, 1 tuần trước, 1 ngày trước");
    expect(templateReminderLabel(templateByKey("HEALTH_CHECKUP")!)).toBe("1 ngày trước, 2 giờ trước");
  });
});
