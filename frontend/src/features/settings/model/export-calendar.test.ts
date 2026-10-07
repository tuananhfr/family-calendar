import { beforeEach, expect, it } from "vitest";
import { accessContextFor } from "@/core/access/evaluate";
import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import { createLocalSpace } from "@/core/repo/write";
import { createItemFromForm, newFormValues } from "@/features/items";
import { buildSpaceIcs, icsFileName } from "./export-calendar";

let spaceId: string;
beforeEach(async () => {
  await db.delete();
  await db.open();
  spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
});

it("exports family events but never a medication reminder", async () => {
  const ctx = { spaceId, timeZone: "Asia/Ho_Chi_Minh", spaceKind: "FAMILY" as const };
  await createItemFromForm({ ...newFormValues("EVENT", { date: "2026-10-08", nowTime: "08:00" }), title: "Họp phụ huynh", startTime: "18:00", endTime: "19:00" }, ctx);
  await createItemFromForm(
    { ...newFormValues("REMINDER", { date: "2026-10-08", nowTime: "08:00" }), title: "Amlodipin", startTime: "07:00", preset: "MEDICATION", category: "HEALTH", sharingScope: "PRIVATE" },
    ctx,
  );
  const { actorId } = await getLocalIdentity();
  const actor = accessContextFor("OWNER", { actorId, representedMemberIds: [], representedProfiles: ["PARENT"], spaceKind: "FAMILY" });
  const { ics, events } = await buildSpaceIcs(spaceId, actor, "Nhà mình", new Date("2026-10-07T00:00:00Z"));
  expect(events).toBe(1);
  expect(ics).toContain("SUMMARY:Họp phụ huynh");
  expect(ics).not.toContain("Amlodipin");
  expect(icsFileName("2026-10-07")).toBe("lich-gia-dinh-2026-10-07.ics");
});
