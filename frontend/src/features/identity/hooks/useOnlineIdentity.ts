"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";
import { SESSION_KEY, type OnlineIdentity } from "../model/session";
export function useOnlineIdentity() {
  return useLiveQuery(async () => ((await db.settings.get(SESSION_KEY))?.value as OnlineIdentity | undefined) ?? null, []);
}
