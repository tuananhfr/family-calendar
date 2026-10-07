import { describe, expect, it } from "vitest";
import { fileDate, fileDateTime, takenLabel } from "./file-label";

describe("file labels", () => {
  it("shows the Space's local date, not UTC", () => {
    expect(fileDate("2026-10-11T18:30:00Z", "Asia/Ho_Chi_Minh")).toBe("12/10/2026");
    expect(fileDateTime("2026-10-11T18:30:00Z", "Asia/Ho_Chi_Minh")).toBe("12/10/2026 01:30");
  });

  it("EXIF time is wall time", () => {
    expect(takenLabel("2026-10-05T07:15")).toBe("05/10/2026 07:15");
  });
});
