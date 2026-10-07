import { describe, expect, it } from "vitest";
import { RELATIONSHIPS } from "@/core/model/common";
import { memberSubtitle, profileForRelationship, relationshipLabel } from "./relationship";

describe("profileForRelationship", () => {
  it("follows the plan mapping", () => {
    expect(profileForRelationship("FATHER")).toBe("PARENT");
    expect(profileForRelationship("MOTHER")).toBe("PARENT");
    expect(profileForRelationship("GUARDIAN")).toBe("PARENT");
    expect(profileForRelationship("OTHER")).toBe("PARENT");
    expect(profileForRelationship("GRANDFATHER")).toBe("SENIOR");
    expect(profileForRelationship("GRANDMOTHER")).toBe("SENIOR");
    expect(profileForRelationship("SON")).toBe("CHILD");
    expect(profileForRelationship("DAUGHTER")).toBe("CHILD");
  });

  it("has a Vietnamese label for every relationship", () => {
    for (const r of RELATIONSHIPS) expect(relationshipLabel(r)).not.toBe("");
  });
});

describe("memberSubtitle", () => {
  const today = "2026-10-06";

  it("shows relationship and age like the mockup", () => {
    expect(
      memberSubtitle(
        {
          displayName: "Bé An",
          relationship: "SON",
          profile: "CHILD",
          birthDate: "2016-06-15",
        },
        today,
      ),
    ).toBe("Con trai · 10 tuổi");
  });

  it("falls back to the profile when the name already says the relationship", () => {
    expect(memberSubtitle({ displayName: "Bố", relationship: "FATHER", profile: "PARENT" }, today)).toBe("Người lớn");
  });
});
