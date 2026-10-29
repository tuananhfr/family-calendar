import { describe, expect, it } from "vitest";
import { matchMember } from "./match-member";

const members = [
  { id: "a", displayName: "Mẹ" },
  { id: "b", displayName: "Bố" },
  { id: "c", displayName: "Bà Nội" },
];

describe("matchMember", () => {
  it("matches ignoring case, diacritics and extra spaces", () => {
    expect(matchMember("me", members)?.id).toBe("a");
    expect(matchMember("  BÀ   nội ", members)?.id).toBe("c");
    expect(matchMember("Bo", members)?.id).toBe("b");
  });

  it("treats đ like d", () => {
    expect(matchMember("Dung", [{ id: "x", displayName: "Đúng" }])?.id).toBe("x");
  });

  it("returns nothing when no profile has that name", () => {
    expect(matchMember("Minh", members)).toBeUndefined();
    expect(matchMember("   ", members)).toBeUndefined();
  });

  it("returns nothing when the name is ambiguous", () => {
    expect(matchMember("Mẹ", [...members, { id: "d", displayName: "me" }])).toBeUndefined();
  });
});
