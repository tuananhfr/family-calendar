"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getActive, listActive } from "@/core/repo/read";
import type { Member } from "@/core/model/member";

function byStatusThenCreated(a: Member, b: Member): number {
  if (a.status !== b.status) return a.status === "ACTIVE" ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/** Live member list, ACTIVE first then in the order they were added; `undefined` while loading. */
export function useMembers(spaceId: string | undefined): Member[] | undefined {
  return useLiveQuery(async () => (spaceId ? (await listActive<Member>("member", spaceId)).sort(byStatusThenCreated) : []), [spaceId]);
}

/** `null` = not found, `undefined` = still loading. */
export function useMember(id: string | null | undefined): Member | null | undefined {
  return useLiveQuery(async () => (id ? ((await getActive<Member>("member", id)) ?? null) : null), [id]);
}
