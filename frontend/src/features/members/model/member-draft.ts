import { newId } from "@/core/ids";
import { profileForRelationship, RELATIONSHIPS, type Relationship } from "@/core/model/common";
import { memberSchema, type Member } from "@/core/model/member";
import { compareLocalDate, isLocalDate, type LocalDate } from "@/core/time/local-date";

/** Form shape: strings stay strings ("" = not filled) so inputs stay controlled. */
export interface MemberDraft {
  displayName: string;
  relationship: Relationship | "";
  birthDate: string;
  phone: string;
  email: string;
  avatar?: string;
  interests: string[];
  note: string;
}

export type MemberDraftField = "displayName" | "relationship" | "birthDate" | "phone" | "email" | "interests" | "note";
export type MemberDraftErrors = Partial<Record<MemberDraftField, string>>;

export function emptyDraft(): MemberDraft {
  return {
    displayName: "",
    relationship: "",
    birthDate: "",
    phone: "",
    email: "",
    interests: [],
    note: "",
  };
}

export function memberToDraft(m: Member): MemberDraft {
  return {
    displayName: m.displayName,
    relationship: m.relationship,
    birthDate: m.birthDate ?? "",
    phone: m.phone ?? "",
    email: m.email ?? "",
    avatar: m.avatar,
    interests: [...m.interests],
    note: m.note ?? "",
  };
}

const blankToUndefined = (s: string) => (s.trim() === "" ? undefined : s.trim());

/**
 * Builds the record to save; `existing` keeps identity, status and sync metadata. Profile is re-derived only when
 * the relationship changes so a manual profile choice survives other edits.
 */
export function draftToMember(d: MemberDraft, ctx: { spaceId: string; actorId: string; existing?: Member }): Member {
  if (!d.relationship) throw new RangeError("relationship is required");
  const now = new Date().toISOString();
  const e = ctx.existing;
  const profile = e && e.relationship === d.relationship ? e.profile : profileForRelationship(d.relationship);
  return {
    id: e?.id ?? newId(),
    spaceId: ctx.spaceId,
    createdByActorId: e?.createdByActorId ?? ctx.actorId,
    dataClass: e?.dataClass ?? "NORMAL",
    sharingScope: e?.sharingScope ?? "FAMILY_ALL",
    revision: e?.revision ?? null,
    createdAt: e?.createdAt ?? now,
    updatedAt: e?.updatedAt ?? now,
    deletedAt: null,
    syncState: e?.syncState ?? "LOCAL",
    displayName: d.displayName.trim(),
    relationship: d.relationship,
    profile,
    birthDate: blankToUndefined(d.birthDate),
    phone: blankToUndefined(d.phone),
    email: blankToUndefined(d.email),
    avatar: d.avatar,
    color: e?.color,
    interests: d.interests.map((i) => i.trim()).filter(Boolean),
    note: blankToUndefined(d.note),
    status: e?.status ?? "ACTIVE",
    linkedActorId: e?.linkedActorId,
  };
}

const FIELD_OF: Record<string, MemberDraftField> = {
  displayName: "displayName",
  relationship: "relationship",
  birthDate: "birthDate",
  phone: "phone",
  email: "email",
  interests: "interests",
  note: "note",
};

/** Field → stable error code (i18n `members.errors.*`); empty object means valid. */
export function validateMemberDraft(d: MemberDraft, today: LocalDate): MemberDraftErrors {
  const errors: MemberDraftErrors = {};
  if (!d.displayName.trim()) errors.displayName = "NAME_REQUIRED";
  if (!d.relationship || !(RELATIONSHIPS as readonly string[]).includes(d.relationship)) errors.relationship = "RELATIONSHIP_REQUIRED";
  if (d.birthDate && isLocalDate(d.birthDate) && compareLocalDate(d.birthDate, today) > 0) errors.birthDate = "BIRTH_IN_FUTURE";

  const probe = draftToMember(
    {
      ...d,
      relationship: d.relationship || "OTHER",
      displayName: d.displayName || "x",
    },
    { spaceId: newId(), actorId: newId() },
  );
  const parsed = memberSchema.safeParse(probe);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = FIELD_OF[String(issue.path[0])];
      if (field && !errors[field]) errors[field] = issue.message;
    }
  }
  return errors;
}
