import { db } from "@/core/db/db";

// Keys of this app in localStorage (persisted UI store); the database holds everything else.
const LOCAL_STORAGE_KEYS = ["fc.app"];

/** Deletes this browser's copy of every Space. Nothing is sent anywhere, and other devices keep their data. */
export async function wipeLocalData(): Promise<void> {
  await db.delete();
  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked (private mode): nothing persisted there to remove.
    }
  }
}

/** Changes of shared Spaces the server has not confirmed yet; a wipe would lose them for good. */
export async function pendingChangeCount(): Promise<number> {
  return db.outbox.filter((op) => op.state !== "ACKNOWLEDGED" && op.state !== "INVALID").count();
}
