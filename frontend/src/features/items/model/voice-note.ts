import { db } from "@/core/db/db";
import { newId } from "@/core/ids";
import type { Recording } from "@/core/platform/media-recorder";

/** Stores a recording in the local `blobs` store; it never leaves the device from here (reminders.md Audio). */
export async function saveVoiceNote(rec: Recording, now: Date = new Date()): Promise<string> {
  const id = newId();
  await db.blobs.put({ id, kind: "AUDIO", mime: rec.mime, size: rec.size, data: rec.blob, durationMs: rec.durationMs, createdAt: now.toISOString() });
  return id;
}

/** Deletes a voice note only when no live item or reminder rule still points at it; returns whether it went. */
export async function discardVoiceNote(id: string): Promise<boolean> {
  return db.transaction("rw", [db.blobs, db.items, db.reminderRules], async () => {
    const usedByItem = await db.items.filter((i) => i.audioAssetId === id && i.deletedAt === null).count();
    const usedByRule = await db.reminderRules.filter((r) => r.audioAssetId === id && r.deletedAt === null).count();
    if (usedByItem + usedByRule > 0) return false;
    await db.blobs.delete(id);
    return true;
  });
}

export type PlayResult = "played" | "blocked" | "missing";

/** Plays a stored voice note; "blocked" means the browser wants a user gesture first (autoplay policy). */
export async function playVoiceNote(id: string): Promise<PlayResult> {
  const row = await db.blobs.get(id);
  if (!row) return "missing";
  const url = URL.createObjectURL(row.data);
  const audio = new Audio(url);
  const revoke = () => URL.revokeObjectURL(url);
  audio.addEventListener("ended", revoke, { once: true });
  audio.addEventListener("error", revoke, { once: true });
  try {
    await audio.play();
    return "played";
  } catch {
    revoke();
    return "blocked";
  }
}
