"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getActive, listActive } from "@/core/repo/read";
import type { Member } from "@/core/model/member";
import { memberViewerActor, memberVisibleTo } from "../model/member-visibility";

function byStatusThenCreated(a: Member, b: Member): number {
  if (a.status !== b.status) return a.status === "ACTIVE" ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/** Live member list, ACTIVE first then in the order they were added; `undefined` while loading. */
export function useMembers(spaceId: string | undefined): Member[] | undefined {
  const result = useLiveQuery(async () => {
    if (!spaceId) return { spaceId, members: [] as Member[] };
    const actorId = await memberViewerActor(spaceId);
    return { spaceId, members: (await listActive<Member>("member", spaceId)).filter((member) => memberVisibleTo(member, actorId)).sort(byStatusThenCreated) };
  }, [spaceId]);
  return result?.spaceId === spaceId ? result?.members : undefined;
}

/** `null` = not found, `undefined` = still loading. */
export function useMember(id: string | null | undefined): Member | null | undefined {
  const result = useLiveQuery(async () => {
    const member = id ? await getActive<Member>("member", id) : undefined;
    const visible = member && memberVisibleTo(member, await memberViewerActor(member.spaceId));
    return { id, member: visible ? member : null };
  }, [id]);
  return result?.id === id ? result?.member : undefined;
}
