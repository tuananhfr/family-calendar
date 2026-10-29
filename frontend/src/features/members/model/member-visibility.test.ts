import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import { createLocalSpace } from "@/core/repo/write";
import { makeMember } from "@/core/test-support/items";
import { memberViewerActor, memberVisibleTo } from "./member-visibility";

beforeEach(async () => { await db.delete(); await db.open(); });
describe("member viewer identity", () => {
  it("uses local identity for local Spaces and online identity only for shared projections", async () => {
    const { actorId } = await getLocalIdentity(); const id = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    await db.settings.put({ key: "online.identity", value: { actorId: "other-online-actor" } });
    expect(await memberViewerActor(id)).toBe(actorId);
    await db.spaces.update(id, { sharingState: "SHARED" }); expect(await memberViewerActor(id)).toBe("other-online-actor");
    await db.spaces.update(id, { deletedAt: new Date().toISOString() }); expect(await memberViewerActor(id)).toBeUndefined();
  });
  it("PRIVATE member records remain creator-only, including for an unknown viewer", () => {
    const member = makeMember("Private", { sharingScope: "PRIVATE", createdByActorId: "owner" });
    expect(memberVisibleTo(member, "owner")).toBe(true); expect(memberVisibleTo(member, "another-owner")).toBe(false); expect(memberVisibleTo(member, undefined)).toBe(false);
  });
});
