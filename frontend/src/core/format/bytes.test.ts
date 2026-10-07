import { expect, it } from "vitest";
import { formatBytes } from "./bytes";

it("formats sizes with a Vietnamese decimal comma", () => {
  expect(formatBytes(0)).toBe("0 B");
  expect(formatBytes(512)).toBe("512 B");
  expect(formatBytes(1536)).toBe("1,5 KB");
  expect(formatBytes(1024 * 1024)).toBe("1 MB");
  expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
});
