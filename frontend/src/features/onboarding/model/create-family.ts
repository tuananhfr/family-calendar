import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import type { Relationship } from "@/core/model/common";
import { createLocalSpace, saveResource } from "@/core/repo/write";
import { draftToMember, emptyDraft } from "@/features/members/model/member-draft";
import { memberSchema } from "@/core/model/member";

export const START_OPTIONS = ["CALENDAR", "TASKS", "REMINDERS", "TIMETABLE", "SPECIAL_DAYS"] as const;
export type StartOption = (typeof START_OPTIONS)[number];

/** Local-only setting; Today uses it to suggest the first thing to add. */
export const ONBOARDING_START_KEY = "onboarding.startWith";

export interface NewFamilyInput {
  familyName: string;
  members: Array<{ relationship: Relationship; displayName: string }>;
  startWith: StartOption;
  timeZone?: string;
}

/** Creates the Space and its members in one transaction so a failed step never leaves a half-made family behind. */
export async function createFamily(input: NewFamilyInput): Promise<{ spaceId: string; memberIds: string[] }> {
  if (input.members.length === 0) throw new RangeError("At least one member is required");
  return db.transaction("rw", [db.localIdentity, db.spaces, db.members, db.outbox, db.settings], async () => {
    const spaceId = await createLocalSpace({
      kind: "FAMILY",
      name: input.familyName,
      timeZone: input.timeZone,
    });
    const { actorId } = await getLocalIdentity();
    const memberIds: string[] = [];
    for (const m of input.members) {
      const member = draftToMember({ ...emptyDraft(), ...m }, { spaceId, actorId });
      memberSchema.parse(member);
      await saveResource("member", member, "create");
      memberIds.push(member.id);
    }
    await db.settings.put({
      key: ONBOARDING_START_KEY,
      value: input.startWith,
    });
    return { spaceId, memberIds };
  });
}
