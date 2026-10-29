"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";
import { loadDataView } from "@/core/repo/data-view";
import { useAccess, useActiveSpace } from "@/features/members";

export function useLocalProjection() {
  const { space, loading: spaceLoading } = useActiveSpace();
  const access = useAccess();
  const result = useLiveQuery(async () => {
    if (!space) return null;
    try { return { data: await loadDataView(space.id), error: false }; }
    catch { return { data: undefined, error: true }; }
  }, [space?.id]);
  const cursor = useLiveQuery(async () => space ? await db.syncCursors.get(space.id) ?? null : null, [space?.id]);
  const denied = space?.sharingState === "SHARED" && !access && cursor !== undefined;
  const data = result?.data?.space.id === space?.id ? result?.data : undefined;
  return { space, access, data, error: result?.error ?? false, loading: spaceLoading || result === undefined || (!!space && !data && !result?.error) || (!access && !denied), denied };
}
