import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/db";
import { addLocalNotification, listNotifications, markAllRead, markRead, unreadCount } from "./local-center";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("local notification center", () => {
  it("lists newest first and counts unread", async () => {
    const a = await addLocalNotification({ spaceId: "s", type: "REMINDER_DUE", titleSafe: "A", createdAt: "2026-10-06T00:00:00.000Z" });
    const b = await addLocalNotification({ spaceId: "s", type: "BUDGET_ALERT", titleSafe: "B", createdAt: "2026-10-06T01:00:00.000Z" });
    expect((await listNotifications()).map((n) => n.id)).toEqual([b, a]);
    expect(await unreadCount()).toBe(2);
    await markRead(a);
    expect(await unreadCount()).toBe(1);
    await markAllRead();
    expect(await unreadCount()).toBe(0);
  });

  it("filters by space and limits", async () => {
    await addLocalNotification({ spaceId: "s1", type: "SYSTEM", titleSafe: "1" });
    await addLocalNotification({ spaceId: "s2", type: "SYSTEM", titleSafe: "2" });
    await addLocalNotification({ spaceId: null, type: "SYSTEM", titleSafe: "3" });
    expect((await listNotifications({ spaceId: "s1" })).map((n) => n.titleSafe).sort()).toEqual(["1", "3"]);
    expect(await listNotifications({ limit: 1 })).toHaveLength(1);
  });

  it("rejects an unknown type and empty text", async () => {
    await expect(addLocalNotification({ spaceId: null, type: "NOPE" as never, titleSafe: "x" })).rejects.toThrow(RangeError);
    await expect(addLocalNotification({ spaceId: null, type: "SYSTEM", titleSafe: " " })).rejects.toThrow(RangeError);
  });

  it("marking an already read notification keeps its first read time", async () => {
    const id = await addLocalNotification({ spaceId: null, type: "SYSTEM", titleSafe: "x" });
    await markRead(id, new Date("2026-10-06T01:00:00.000Z"));
    await markRead(id, new Date("2026-10-06T02:00:00.000Z"));
    expect((await db.notifications.get(id))?.readAt).toBe("2026-10-06T01:00:00.000Z");
  });
});
