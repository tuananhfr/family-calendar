import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import { listActive, listSpaces } from "@/core/repo/read";
import type { Member } from "@/core/model/member";
import { createFamily, ONBOARDING_START_KEY } from "./create-family";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("createFamily", () => {
  it("creates a LOCAL family space with its members and remembers the starting point", async () => {
    const { spaceId, memberIds } = await createFamily({
      familyName: "Nhà mình",
      members: [
        { relationship: "FATHER", displayName: "Bố" },
        { relationship: "MOTHER", displayName: "Mẹ" },
        { relationship: "SON", displayName: "Minh" },
      ],
      startWith: "TIMETABLE",
    });
    const spaces = await listSpaces();
    expect(spaces).toHaveLength(1);
    expect(spaces[0]).toMatchObject({
      id: spaceId,
      kind: "FAMILY",
      name: "Nhà mình",
      sharingState: "LOCAL",
    });
    const members = await listActive<Member>("member", spaceId);
    expect(members.map((m) => [m.displayName, m.profile]).sort()).toEqual([
      ["Bố", "PARENT"],
      ["Minh", "CHILD"],
      ["Mẹ", "PARENT"],
    ]);
    expect(memberIds).toHaveLength(3);
    expect(await db.outbox.count()).toBe(0);
    expect((await db.settings.get(ONBOARDING_START_KEY))?.value).toBe("TIMETABLE");
  });

  it("writes nothing when one member is invalid", async () => {
    await expect(
      createFamily({
        familyName: "Nhà mình",
        members: [
          { relationship: "FATHER", displayName: "Bố" },
          { relationship: "SON", displayName: " " },
        ],
        startWith: "CALENDAR",
      }),
    ).rejects.toThrow();
    expect(await db.spaces.count()).toBe(0);
    expect(await db.members.count()).toBe(0);
  });

  it("requires at least one member", async () => {
    await expect(
      createFamily({
        familyName: "Nhà mình",
        members: [],
        startWith: "CALENDAR",
      }),
    ).rejects.toThrow(RangeError);
  });
});
