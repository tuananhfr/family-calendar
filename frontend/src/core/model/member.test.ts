import { describe, expect, it } from "vitest";
import { memberSchema } from "./member";
import { baseFields, issueCodes } from "../test-support/records";

const valid = () => ({
  ...baseFields(),
  displayName: "Bà Nội",
  relationship: "GRANDMOTHER",
  profile: "SENIOR",
  interests: [],
  status: "ACTIVE",
});

describe("memberSchema", () => {
  it("accepts a minimal member (name + relationship + profile)", () => {
    expect(memberSchema.safeParse(valid()).success).toBe(true);
  });

  it("requires a display name", () => {
    expect(issueCodes(memberSchema.safeParse({ ...valid(), displayName: "  " }))).toContain("NAME_REQUIRED");
  });

  it("limits interests to 5 short unique tags", () => {
    expect(memberSchema.safeParse({ ...valid(), interests: ["a", "b", "c", "d", "e"] }).success).toBe(true);
    expect(issueCodes(memberSchema.safeParse({ ...valid(), interests: ["a", "b", "c", "d", "e", "f"] }))).toContain(
      "INTERESTS_TOO_MANY",
    );
    expect(issueCodes(memberSchema.safeParse({ ...valid(), interests: ["a", "a"] }))).toContain("INTERESTS_DUPLICATE");
  });

  it("validates optional email and birth date", () => {
    expect(memberSchema.safeParse({ ...valid(), email: "ba@example.com", birthDate: "1950-02-28" }).success).toBe(true);
    expect(issueCodes(memberSchema.safeParse({ ...valid(), email: "nope" }))).toContain("INVALID_EMAIL");
    expect(issueCodes(memberSchema.safeParse({ ...valid(), birthDate: "1950-02-30" }))).toContain("INVALID_DATE");
  });
});
