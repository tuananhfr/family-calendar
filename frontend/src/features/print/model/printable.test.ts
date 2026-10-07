import { expect, it } from "vitest";
import { isPrintable } from "./printable";

const base = { sharingScope: "FAMILY_ALL", dataClass: "NORMAL", category: "FAMILY", preset: "EVENT" } as const;

it("prints shared family items only", () => {
  expect(isPrintable(base)).toBe(true);
  expect(isPrintable({ ...base, sharingScope: "PRIVATE" })).toBe(false);
  expect(isPrintable({ ...base, dataClass: "SENSITIVE" })).toBe(false);
  expect(isPrintable({ ...base, dataClass: "PRIVATE" })).toBe(false);
  // A medication mislabelled NORMAL still stays off paper.
  expect(isPrintable({ ...base, category: "HEALTH" })).toBe(false);
  expect(isPrintable({ ...base, preset: "MEDICATION" })).toBe(false);
});
