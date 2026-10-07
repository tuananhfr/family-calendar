import { db } from "@/core/db/db";

/** Acting on an in-app alert answers its notification too, so the bell does not keep counting it. */
export async function markOccurrenceRead(occurrenceKey: string, at: Date = new Date()): Promise<void> {
  await db.notifications.filter((r) => r.readAt === null && r.resourceRef?.type === "occurrence" && r.resourceRef.id === occurrenceKey).modify({ readAt: at.toISOString() });
}
