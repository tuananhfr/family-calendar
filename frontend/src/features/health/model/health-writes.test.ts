import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import type { HealthProfile } from "@/core/model/health";
import { listActive } from "@/core/repo/read";
import { createLocalSpace } from "@/core/repo/write";
import { deleteHealthRecord, HealthFormError, saveHealthMetric, saveHealthNote, saveHealthProfile } from "./health-writes";

const MEMBER = "11111111-1111-4111-8111-111111111111";
let spaceId: string;

beforeEach(async () => {
  await db.delete();
  await db.open();
  spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà" });
});

describe("health writes", () => {
  it("stores health records as SENSITIVE family data", async () => {
    const m = await saveHealthMetric(spaceId, { memberId: MEMBER, type: "WEIGHT", value: 6, measuredAt: "2026-10-06T08:00" });
    expect(m).toMatchObject({ dataClass: "SENSITIVE", sharingScope: "FAMILY_ALL", value: 6 });
    const n = await saveHealthNote(spaceId, { memberId: MEMBER, date: "2026-10-06", title: "Tiêm phòng", body: "" });
    expect(n.dataClass).toBe("SENSITIVE");
  });

  it("rejects an impossible reading with the plain message and keeps unusual ones", async () => {
    const bad = saveHealthMetric(spaceId, { memberId: MEMBER, type: "BLOOD_PRESSURE", value: 300, value2: 20, measuredAt: "2026-10-06T08:00" });
    await expect(bad).rejects.toBeInstanceOf(HealthFormError);
    await expect(bad).rejects.toMatchObject({ fields: { value: expect.stringMatching(/^Giá trị ngoài khoảng đo được/) } });
    await expect(saveHealthMetric(spaceId, { memberId: MEMBER, type: "BLOOD_PRESSURE", value: 160, value2: 100, measuredAt: "2026-10-06T08:00" })).resolves.toMatchObject({ value2: 100 });
    await expect(saveHealthMetric(spaceId, { memberId: MEMBER, type: "BLOOD_PRESSURE", value: 120, measuredAt: "2026-10-06T08:00" })).rejects.toBeInstanceOf(HealthFormError);
  });

  it("keeps one profile per member and deletes records softly", async () => {
    await saveHealthProfile(spaceId, { memberId: MEMBER, sex: "MALE", allergies: [], conditions: [] });
    const second = await saveHealthProfile(spaceId, { memberId: MEMBER, sex: "MALE", bloodType: "O+", allergies: ["Tôm"], conditions: [] });
    const all = await listActive<HealthProfile>("health_profile", spaceId);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ bloodType: "O+", allergies: ["Tôm"] });
    await deleteHealthRecord("health_profile", second.id);
    expect(await listActive("health_profile", spaceId)).toHaveLength(0);
  });
});
