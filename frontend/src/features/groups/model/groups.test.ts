import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import { accessContextFor } from "@/core/access/evaluate";
import { createLocalSpace } from "@/core/repo/write";
import { createGroup, filteredGroups, updateGroup } from "./groups";

beforeEach(async () => { await db.delete(); await db.open(); });
describe("GROUP isolation", () => {
  const input = { name: "Lớp 5A", description: "Lịch học chung", groupType: "CLASS" as const, selfName: "Người tổ chức" };
  it("creates a local group, its own member and three GROUP roles without copying family data", async () => {
    const familyId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    const id = await createGroup(input);
    expect(await db.spaces.get(id)).toMatchObject({ kind: "GROUP", sharingScope: "GROUP_MEMBERS", sharingState: "LOCAL", settings: { groupType: "CLASS" } });
    const members = await db.members.toArray();
    expect(members).toHaveLength(1); expect(members[0].spaceId).toBe(id); expect(members[0].spaceId).not.toBe(familyId);
    expect((await db.roles.toArray()).map((role) => role.key).sort()).toEqual(["GUEST", "ORGANIZER", "PARTICIPANT"]);
    expect(await db.outbox.count()).toBe(0);
    expect(filteredGroups(await db.spaces.toArray(), "CLASS", "lop 5")).toHaveLength(1);
    expect(filteredGroups(await db.spaces.toArray(), "FAMILY", "").map((space) => space.id)).toEqual([familyId]);
  });
  it("rolls back the whole group if its member cannot persist", async () => {
    const spy = vi.spyOn(db.members, "add").mockRejectedValueOnce(new DOMException("Full", "QuotaExceededError"));
    await expect(createGroup(input)).rejects.toThrow(); spy.mockRestore();
    expect(await db.spaces.count()).toBe(0); expect(await db.roles.count()).toBe(0);
  });
  it("updates group metadata with organizer permission and rejects participants and FAMILY access", async () => {
    const id = await createGroup(input);
    const space = (await db.spaces.get(id))!;
    const { actorId } = await getLocalIdentity();
    const identity = { actorId, spaceKind: "GROUP" as const, representedMemberIds: [], representedProfiles: [] };
    await expect(updateGroup(space, input, accessContextFor("PARTICIPANT", identity))).rejects.toThrow("FORBIDDEN");
    await expect(updateGroup(space, input, accessContextFor("OWNER", { ...identity, spaceKind: "FAMILY" }))).rejects.toThrow("FORBIDDEN");
    await updateGroup(space, { ...input, name: "Lớp 5B", groupType: "ACTIVITY" }, accessContextFor("ORGANIZER", identity));
    expect(await db.spaces.get(id)).toMatchObject({ name: "Lớp 5B", settings: { groupType: "ACTIVITY" } });
  });
});
