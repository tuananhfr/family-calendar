import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import { createLocalSpace } from "@/core/repo/write";
import { createItemFromForm } from "./item-writes";
import { newFormValues } from "./item-types";
import { discardVoiceNote, saveVoiceNote } from "./voice-note";

const recording = () => ({ blob: new Blob(["abc"], { type: "audio/webm" }), mime: "audio/webm", durationMs: 3200, size: 3 });

let spaceId: string;
beforeEach(async () => {
  await db.delete();
  await db.open();
  spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
});

describe("voice notes", () => {
  it("saves the recording with its duration as an AUDIO blob", async () => {
    const id = await saveVoiceNote(recording(), new Date("2026-10-06T01:00:00Z"));
    expect(await db.blobs.get(id)).toMatchObject({ kind: "AUDIO", mime: "audio/webm", size: 3, durationMs: 3200, createdAt: "2026-10-06T01:00:00.000Z" });
  });

  it("discards an unused note but keeps one a reminder still uses", async () => {
    const loose = await saveVoiceNote(recording());
    expect(await discardVoiceNote(loose)).toBe(true);
    expect(await db.blobs.get(loose)).toBeUndefined();

    const used = await saveVoiceNote(recording());
    await createItemFromForm(
      { ...newFormValues("REMINDER", { date: "2026-10-06", nowTime: "06:00" }), title: "Gọi bà", startTime: "07:00", audioAssetId: used },
      { spaceId, timeZone: "Asia/Ho_Chi_Minh", spaceKind: "FAMILY" },
    );
    expect(await discardVoiceNote(used)).toBe(false);
    expect(await db.blobs.get(used)).toBeDefined();
  });
});
