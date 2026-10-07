import { beforeEach, expect, it } from "vitest";
import { db } from "@/core/db/db";
import { addLocalNotification } from "@/core/notifications/local-center";
import { markOccurrenceRead } from "./notification-actions";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it("marks only the notifications of that occurrence as read", async () => {
  const a = await addLocalNotification({ spaceId: "s1", type: "REMINDER_DUE", titleSafe: "a", resourceRef: { type: "occurrence", id: "i1@2026-10-06T07:00" } });
  const b = await addLocalNotification({ spaceId: "s1", type: "REMINDER_DUE", titleSafe: "b", resourceRef: { type: "occurrence", id: "i1@2026-10-07T07:00" } });
  await markOccurrenceRead("i1@2026-10-06T07:00", new Date("2026-10-06T00:05:00Z"));
  expect((await db.notifications.get(a))?.readAt).toBe("2026-10-06T00:05:00.000Z");
  expect((await db.notifications.get(b))?.readAt).toBeNull();
});
