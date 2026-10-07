import { describe, expect, it } from "vitest";
import { newId } from "../ids";
import type { Profile, SharingScope, DataClass } from "../model/common";
import type { BaseRecord } from "../sync/resource-types";
import { baseFields } from "../test-support/records";
import { DEFAULT_ROLE_MATRIX, type DefaultRoleKey } from "./capabilities";
import {
  accessContextFor,
  canDelete,
  canRead,
  canReadItem,
  canWrite,
  canWriteItem,
  capabilityForItem,
  type AccessContext,
} from "./evaluate";

const SPACE = newId();

function ctx(role: DefaultRoleKey, profiles: Profile[], extra: Partial<AccessContext> = {}): AccessContext {
  return accessContextFor(role, {
    actorId: newId(),
    representedMemberIds: [newId()],
    representedProfiles: profiles,
    spaceKind: "FAMILY",
    ...extra,
  });
}

function rec(
  createdBy: string,
  scope: SharingScope,
  dataClass: DataClass = "NORMAL",
  extra: { memberIds?: string[]; memberId?: string } = {},
): BaseRecord & { memberIds?: string[]; memberId?: string } {
  return { ...baseFields({ spaceId: SPACE, createdByActorId: createdBy, sharingScope: scope, dataClass }), ...extra };
}

describe("DEFAULT_ROLE_MATRIX (modules.md §2.2)", () => {
  it("matches the table for a few spot checks", () => {
    expect(DEFAULT_ROLE_MATRIX.OWNER.permissions).toBe("EDIT");
    expect(DEFAULT_ROLE_MATRIX.ADULT.permissions).toBe("NONE");
    expect(DEFAULT_ROLE_MATRIX.ADULT.settings).toBe("VIEW");
    expect(DEFAULT_ROLE_MATRIX.MEMBER["calendar.view"]).toBe("VIEW");
    expect(DEFAULT_ROLE_MATRIX.SENIOR.members).toBe("VIEW");
    expect(DEFAULT_ROLE_MATRIX.GUARDIAN.health).toBe("VIEW");
    expect(DEFAULT_ROLE_MATRIX.GUARDIAN["calendar.create"]).toBe("NONE");
    expect(DEFAULT_ROLE_MATRIX.GUEST["sos.trigger"]).toBe("NONE");
    expect(DEFAULT_ROLE_MATRIX.MEMBER["sos.trigger"]).toBe("EDIT");
    for (const role of Object.values(DEFAULT_ROLE_MATRIX)) expect(Object.keys(role)).toHaveLength(14);
  });
});

describe("capabilityForItem", () => {
  it("maps kind/preset/category to the capability of §2.3", () => {
    expect(capabilityForItem({ kind: "REMINDER", preset: "MEDICATION", category: "HEALTH" })).toBe("health");
    expect(capabilityForItem({ kind: "EVENT", preset: "APPOINTMENT", category: "HEALTH" })).toBe("health");
    expect(capabilityForItem({ kind: "EVENT", preset: "TIMETABLE", category: "STUDY" })).toBe("timetable");
    expect(capabilityForItem({ kind: "REMINDER", preset: "PAYMENT", category: "FINANCE" })).toBe("finance");
    expect(capabilityForItem({ kind: "TASK", preset: "HOUSEWORK", category: "HOUSEWORK" })).toBe("calendar.view");
  });
});

describe("canRead / canWrite", () => {
  it("OWNER cannot read another actor's PRIVATE record; the creator can", () => {
    const owner = ctx("OWNER", ["PARENT"]);
    const other = ctx("ADULT", ["PARENT"]);
    const r = rec(other.actorId, "PRIVATE", "PRIVATE");
    expect(canRead(owner, r, "calendar.view")).toBe(false);
    expect(canWrite(owner, r, "calendar.view")).toBe(false);
    expect(canRead(other, r, "calendar.view")).toBe(true);
    expect(canWrite(other, r, "calendar.view")).toBe(true);
  });

  it("MEMBER cannot read finance", () => {
    const child = ctx("MEMBER", ["CHILD"]);
    const owner = ctx("OWNER", ["PARENT"]);
    const txn = rec(owner.actorId, "FAMILY_ALL", "PRIVATE");
    expect(canRead(child, txn, "finance")).toBe(false);
    expect(canRead(owner, txn, "finance")).toBe(true);
  });

  it("SENIOR can view the calendar but not edit someone else's item; can edit own/assigned items", () => {
    const senior = ctx("SENIOR", ["SENIOR"]);
    const owner = ctx("OWNER", ["PARENT"]);
    const othersItem = rec(owner.actorId, "FAMILY_ALL");
    expect(canRead(senior, othersItem, "calendar.view")).toBe(true);
    expect(canWrite(senior, othersItem, "calendar.view")).toBe(false);
    expect(canWrite(senior, rec(senior.actorId, "FAMILY_ALL"), "calendar.view")).toBe(true);
    const assigned = rec(owner.actorId, "FAMILY_ALL", "NORMAL", { memberIds: [senior.representedMemberIds[0]] });
    expect(canWrite(senior, assigned, "calendar.view")).toBe(true);
    expect(canDelete(senior, rec(senior.actorId, "FAMILY_ALL"), "calendar.view")).toBe(false);
    expect(canDelete(owner, othersItem, "calendar.view")).toBe(true);
  });

  it("GUARDIAN reads health of the guarded member only", () => {
    const guarded = newId();
    const guardian = ctx("GUARDIAN", ["PARENT"], { guardedMemberIds: [guarded] });
    const owner = ctx("OWNER", ["PARENT"]);
    const guardedProfile = rec(owner.actorId, "FAMILY_ALL", "SENSITIVE", { memberId: guarded });
    const otherProfile = rec(owner.actorId, "FAMILY_ALL", "SENSITIVE", { memberId: newId() });
    expect(canRead(guardian, guardedProfile, "health")).toBe(true);
    expect(canWrite(guardian, guardedProfile, "health")).toBe(false);
    expect(canRead(guardian, otherProfile, "health")).toBe(false);
  });

  it("a member always reads and edits their own health record even with health NONE", () => {
    const child = ctx("MEMBER", ["CHILD"]);
    const owner = ctx("OWNER", ["PARENT"]);
    const own = rec(owner.actorId, "FAMILY_ALL", "SENSITIVE", { memberId: child.representedMemberIds[0] });
    expect(canRead(child, own, "health")).toBe(true);
    expect(canWrite(child, own, "health")).toBe(true);
    expect(canRead(child, rec(owner.actorId, "FAMILY_ALL", "SENSITIVE", { memberId: newId() }), "health")).toBe(false);
  });

  it("PARENTS_SENIORS is hidden from CHILD profiles, PARENTS_CHILDREN from SENIOR profiles", () => {
    const owner = ctx("OWNER", ["PARENT"]);
    const child = ctx("MEMBER", ["CHILD"]);
    const senior = ctx("SENIOR", ["SENIOR"]);
    expect(canRead(child, rec(owner.actorId, "PARENTS_SENIORS"), "calendar.view")).toBe(false);
    expect(canRead(senior, rec(owner.actorId, "PARENTS_SENIORS"), "calendar.view")).toBe(true);
    expect(canRead(senior, rec(owner.actorId, "PARENTS_CHILDREN"), "calendar.view")).toBe(false);
    expect(canRead(child, rec(owner.actorId, "PARENTS_CHILDREN"), "calendar.view")).toBe(true);
    expect(canRead(owner, rec(child.actorId, "PARENTS_SENIORS"), "calendar.view")).toBe(true);
  });

  it("a GROUP context cannot use FAMILY_* scopes and vice versa", () => {
    const organizer = accessContextFor("ORGANIZER", {
      actorId: newId(),
      representedMemberIds: [newId()],
      representedProfiles: ["PARENT"],
      spaceKind: "GROUP",
    });
    const other = newId();
    expect(canRead(organizer, rec(other, "FAMILY_ALL"), "calendar.view")).toBe(false);
    expect(canRead(organizer, rec(organizer.actorId, "FAMILY_ALL"), "calendar.view")).toBe(false);
    expect(canRead(organizer, rec(other, "GROUP_MEMBERS"), "calendar.view")).toBe(true);
    expect(canRead(organizer, rec(other, "GROUP_MANAGERS"), "calendar.view")).toBe(true);
    const owner = ctx("OWNER", ["PARENT"]);
    expect(canRead(owner, rec(other, "GROUP_MEMBERS"), "calendar.view")).toBe(false);
  });

  it("GROUP_MANAGERS is hidden from plain participants", () => {
    const participant = accessContextFor("PARTICIPANT", {
      actorId: newId(),
      representedMemberIds: [newId()],
      representedProfiles: ["CHILD"],
      spaceKind: "GROUP",
    });
    expect(canRead(participant, rec(newId(), "GROUP_MANAGERS"), "calendar.view")).toBe(false);
    expect(canRead(participant, rec(newId(), "GROUP_MEMBERS"), "calendar.view")).toBe(true);
  });

  it("GUEST sees family-wide calendar but cannot write", () => {
    const guest = ctx("GUEST", ["PARENT"]);
    const r = rec(newId(), "FAMILY_ALL");
    expect(canRead(guest, r, "calendar.view")).toBe(true);
    expect(canWrite(guest, r, "calendar.view")).toBe(false);
    expect(canRead(guest, r, "storage")).toBe(false);
  });

  it("SENSITIVE items shared family-wide stay hidden from members without health access", () => {
    const owner = ctx("OWNER", ["PARENT"]);
    const child = ctx("MEMBER", ["CHILD"]);
    const medication = { ...rec(owner.actorId, "FAMILY_ALL", "SENSITIVE"), kind: "REMINDER" as const, preset: "MEDICATION" as const, category: "HEALTH" as const };
    expect(canReadItem(owner, medication)).toBe(true);
    expect(canReadItem(child, medication)).toBe(false);
    const forChild = { ...medication, memberIds: [child.representedMemberIds[0]] };
    expect(canReadItem(child, forChild)).toBe(true);
  });

  it("payment reminders are reachable through finance or calendar capability", () => {
    const owner = ctx("OWNER", ["PARENT"]);
    const child = ctx("MEMBER", ["CHILD"]);
    const payment = { ...rec(owner.actorId, "FAMILY_ALL"), kind: "REMINDER" as const, preset: "PAYMENT" as const, category: "FINANCE" as const };
    expect(canReadItem(child, payment)).toBe(true);
    expect(canWriteItem(child, payment)).toBe(false);
    expect(canWriteItem(owner, payment)).toBe(true);
  });
});
