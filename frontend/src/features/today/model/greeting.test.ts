import { describe, expect, it } from "vitest";
import { withProcessTimeZone } from "@/core/test-support/process-tz";
import { greetingFor, timeZoneNote, todayHeader } from "./greeting";

describe("greetingFor", () => {
  it.each([
    ["03:59", "Chào buổi tối!"],
    ["04:00", "Chào buổi sáng!"],
    ["10:59", "Chào buổi sáng!"],
    ["11:00", "Chào buổi trưa!"],
    ["12:59", "Chào buổi trưa!"],
    ["13:00", "Chào buổi chiều!"],
    ["17:59", "Chào buổi chiều!"],
    ["18:00", "Chào buổi tối!"],
    ["23:59", "Chào buổi tối!"],
    ["00:00", "Chào buổi tối!"],
  ])("%s → %s", (time, greeting) => {
    expect(greetingFor(time)).toBe(greeting);
  });

  it("accepts a full LocalDateTime", () => {
    expect(greetingFor("2026-10-06T07:15")).toBe("Chào buổi sáng!");
  });
});

describe("timeZoneNote", () => {
  const now = new Date("2026-10-05T17:30:00Z");

  it("is null when the device shows the same offset as the Space", () => {
    expect(timeZoneNote("Asia/Ho_Chi_Minh", now, 420)).toBeNull();
  });

  it("names Vietnam and GMT+7 when the device is elsewhere", () => {
    expect(timeZoneNote("Asia/Ho_Chi_Minh", now, -420)).toBe("Giờ theo Việt Nam (GMT+7)");
  });

  it("formats other zones with their city and half-hour offsets", () => {
    expect(timeZoneNote("Asia/Kolkata", now, 420)).toBe("Giờ theo Kolkata (GMT+5:30)");
    expect(timeZoneNote("America/Los_Angeles", now, 420)).toBe("Giờ theo Los Angeles (GMT-7)");
  });
});

describe("todayHeader (Review Focus #3)", () => {
  // 00:30 on 6/10 in Vietnam is still the evening of 5/10 in Los Angeles.
  const now = new Date("2026-10-05T17:30:00Z");

  it("uses the Space time zone for today, the greeting and the lunar date while the machine is in Los Angeles", () => {
    const header = withProcessTimeZone("America/Los_Angeles", () => todayHeader("Asia/Ho_Chi_Minh", now));
    expect(header).toEqual({
      today: "2026-10-06",
      time: "00:30",
      greeting: "Chào buổi tối!",
      lunarLabel: "26 tháng 8 (Âm lịch)",
      timeZoneNote: "Giờ theo Việt Nam (GMT+7)",
    });
  });

  it("has no time zone note when the machine is in Vietnam", () => {
    const header = withProcessTimeZone("Asia/Ho_Chi_Minh", () => todayHeader("Asia/Ho_Chi_Minh", now));
    expect(header.today).toBe("2026-10-06");
    expect(header.timeZoneNote).toBeNull();
  });
});
