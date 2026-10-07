import { describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { memberSchema } from "@/core/model/member";
import { draftToMember, emptyDraft, memberToDraft, validateMemberDraft, type MemberDraft } from "./member-draft";

const today = "2026-10-06";
const ctx = { spaceId: newId(), actorId: newId() };

function draft(patch: Partial<MemberDraft> = {}): MemberDraft {
  return {
    ...emptyDraft(),
    displayName: "Bé An",
    relationship: "SON",
    ...patch,
  };
}

describe("validateMemberDraft", () => {
  it("only needs a name and a relationship", () => {
    expect(validateMemberDraft(draft(), today)).toEqual({});
  });

  it("reports missing name and relationship", () => {
    expect(validateMemberDraft(draft({ displayName: "  ", relationship: "" }), today)).toEqual({
      displayName: "NAME_REQUIRED",
      relationship: "RELATIONSHIP_REQUIRED",
    });
  });

  it("rejects a birth date after today", () => {
    expect(validateMemberDraft(draft({ birthDate: "2026-10-07" }), today)).toEqual({ birthDate: "BIRTH_IN_FUTURE" });
  });

  it("maps schema codes for phone, email and interests", () => {
    const errors = validateMemberDraft(
      draft({
        phone: "abc",
        email: "x@",
        interests: ["a", "b", "c", "d", "e", "f"],
      }),
      today,
    );
    expect(errors).toMatchObject({
      phone: "INVALID_PHONE",
      email: "INVALID_EMAIL",
      interests: "INTERESTS_TOO_MANY",
    });
  });
});

describe("draftToMember", () => {
  it("derives profile from relationship and drops empty optionals", () => {
    const m = draftToMember(draft({ phone: " ", email: "" }), ctx);
    expect(m.profile).toBe("CHILD");
    expect(m.phone).toBeUndefined();
    expect(m.email).toBeUndefined();
    expect(m.status).toBe("ACTIVE");
    expect(memberSchema.safeParse(m).success).toBe(true);
  });

  it("keeps id, createdAt and status of an existing member", () => {
    const first = draftToMember(draft(), ctx);
    const archived = { ...first, status: "ARCHIVED" as const };
    const next = draftToMember(draft({ displayName: "An" }), {
      ...ctx,
      existing: archived,
    });
    expect(next.id).toBe(first.id);
    expect(next.createdAt).toBe(first.createdAt);
    expect(next.status).toBe("ARCHIVED");
    expect(next.displayName).toBe("An");
  });

  it("round-trips through memberToDraft", () => {
    const m = draftToMember(
      draft({
        birthDate: "2016-06-15",
        interests: ["Vẽ tranh"],
        note: "Dị ứng tôm",
      }),
      ctx,
    );
    expect(draftToMember(memberToDraft(m), { ...ctx, existing: m })).toEqual(m);
  });
});
