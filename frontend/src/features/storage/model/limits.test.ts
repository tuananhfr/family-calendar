import { describe, expect, it } from "vitest";
import { checkLimits } from "./limits";

const MB = 1024 * 1024;
const GB = 1024 * MB;

describe("checkLimits", () => {
  it("video over 200 MB → FILE_TOO_LARGE", () => {
    expect(checkLimits({ size: 201 * MB, kind: "VIDEO" }, null)).toMatchObject({ ok: false, code: "FILE_TOO_LARGE", message: "Tệp quá lớn. Video tối đa 200 MB." });
    expect(checkLimits({ size: 200 * MB, kind: "VIDEO" }, null)).toEqual({ ok: true, warnLowSpace: false });
  });

  it("images and documents stop at 25 MB", () => {
    expect(checkLimits({ size: 25 * MB + 1, kind: "IMAGE" }, null)).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
    expect(checkLimits({ size: 26 * MB, kind: "DOCUMENT" }, null)).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
  });

  it("warns when less than 10% of the quota would be left", () => {
    expect(checkLimits({ size: MB, kind: "IMAGE" }, { usage: 9.5 * GB, quota: 10 * GB })).toEqual({ ok: true, warnLowSpace: true });
    expect(checkLimits({ size: MB, kind: "IMAGE" }, { usage: 8.9 * GB, quota: 10 * GB })).toEqual({ ok: true, warnLowSpace: false });
    expect(checkLimits({ size: MB, kind: "IMAGE" }, { usage: 5 * GB, quota: 10 * GB })).toEqual({ ok: true, warnLowSpace: false });
  });

  it("refuses a file that does not fit", () => {
    expect(checkLimits({ size: 20 * MB, kind: "IMAGE" }, { usage: 100 * MB - 10, quota: 100 * MB })).toMatchObject({ ok: false, code: "STORAGE_FULL" });
  });

  it("no estimate → only the per-file limit applies", () => {
    expect(checkLimits({ size: MB, kind: "OTHER" }, { usage: 0, quota: 0 })).toEqual({ ok: true, warnLowSpace: false });
  });
});
