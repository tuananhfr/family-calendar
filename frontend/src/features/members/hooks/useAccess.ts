"use client";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { accessContextFor, type AccessContext } from "@/core/access/evaluate";
import type { DefaultRoleKey } from "@/core/access/capabilities";
import { getLocalIdentity } from "@/core/db/local-identity";
import { db } from "@/core/db/db";
import type { Member } from "@/core/model/member";
import { getActive } from "@/core/repo/read";
import { useAppStore } from "@/store/app.store";
import { useOnlineIdentity } from "@/features/identity/hooks/useOnlineIdentity";
import { useActiveSpace } from "./useActiveSpace";
export function useAccess(): AccessContext | undefined {
  const { space } = useActiveSpace();
  const usingMemberId = useAppStore((s) => s.usingMemberId);
  const online = useOnlineIdentity();
  const [actorId, setActorId] = useState<string>();
  useEffect(() => { void getLocalIdentity().then((i) => setActorId(i.actorId)); }, []);
  const cursor = useLiveQuery(async () => space ? await db.syncCursors.get(space.id) ?? null : null, [space?.id]);
  const members = useLiveQuery(async () => space ? await db.members.where("spaceId").equals(space.id).toArray() : [], [space?.id]);
  const usingMember = useLiveQuery(async () => usingMemberId ? await getActive<Member>("member", usingMemberId) ?? null : null, [usingMemberId]);
  return useMemo(() => {
    if (!space || !actorId || usingMember === undefined) return undefined;
    if (space.sharingState === "SHARED") {
      const access = cursor?.access;
      if (!access || !online || access.actorId !== online.actorId || cursor?.halt === "BLOCKED") return undefined;
      const represented = (access.representedMemberIds ?? []) as string[];
      return { actorId: online.actorId, spaceKind: space.kind,
        roleMatrix: access.matrix as AccessContext["roleMatrix"], restrictions: access.restrictions as AccessContext["restrictions"],
        representedMemberIds: represented, representedProfiles: (members ?? []).filter((m) => represented.includes(m.id)).map((m) => m.profile),
        guardedMemberIds: (access.guardianOfMemberIds ?? []) as string[], isManager: ["OWNER", "ORGANIZER"].includes(String(access.roleKey)) };
    }
    const member = usingMember && usingMember.spaceId === space.id ? usingMember : null;
    const role: DefaultRoleKey = member?.profile === "CHILD" ? "MEMBER" : member?.profile === "SENIOR" ? "SENIOR" : "OWNER";
    return accessContextFor(role, { actorId, spaceKind: space.kind, representedMemberIds: member ? [member.id] : [], representedProfiles: member ? [member.profile] : ["PARENT"] });
  }, [space, actorId, usingMember, cursor, online, members]);
}
