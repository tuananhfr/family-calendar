"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { accessContextFor, type AccessContext } from "@/core/access/evaluate";
import type { DefaultRoleKey } from "@/core/access/capabilities";
import { getLocalIdentity } from "@/core/db/local-identity";
import type { Member } from "@/core/model/member";
import { getActive } from "@/core/repo/read";
import { useAppStore } from "@/store/app.store";
import { useActiveSpace } from "./useActiveSpace";

/**
 * Local-only access: the device owner created the Space and is OWNER, but when the device is set to "being used by"
 * a child or grandparent the UI narrows to that profile's role so a shared tablet doesn't expose finance or health.
 * Shared Spaces get their real role from the server (Task 39+); this stays a UI-only filter.
 */
export function useAccess(): AccessContext | undefined {
  const { space } = useActiveSpace();
  const usingMemberId = useAppStore((s) => s.usingMemberId);
  const [actorId, setActorId] = useState<string>();
  useEffect(() => {
    void getLocalIdentity().then((i) => setActorId(i.actorId));
  }, []);
  const usingMember = useLiveQuery(async () => (usingMemberId ? ((await getActive<Member>("member", usingMemberId)) ?? null) : null), [usingMemberId]);

  return useMemo(() => {
    if (!space || !actorId || usingMember === undefined) return undefined;
    const member = usingMember && usingMember.spaceId === space.id ? usingMember : null;
    const role: DefaultRoleKey = member?.profile === "CHILD" ? "MEMBER" : member?.profile === "SENIOR" ? "SENIOR" : "OWNER";
    return accessContextFor(role, {
      actorId,
      spaceKind: space.kind,
      representedMemberIds: member ? [member.id] : [],
      representedProfiles: member ? [member.profile] : ["PARENT"],
    });
  }, [space, actorId, usingMember]);
}
