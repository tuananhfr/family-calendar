"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/core/api/client";
import { useActiveSpace } from "@/features/members/hooks/useActiveSpace";
import { useOnlineIdentity } from "@/features/identity/hooks/useOnlineIdentity";
import type { NotificationRow } from "@/core/db/db";
import { listNotifications, unreadCount } from "@/core/notifications/local-center";

export const SCREEN_NOTIFICATIONS_KEY = "screen-notifications";
interface ServerNotification {
  id: string; space_id: string; type: string; title_safe: string; created_at: string;
  read_at: string | null; resource_ref: { type: string; id: string } | null;
}

function useScreenNotifications(spaceId: string | undefined) {
  const { space } = useActiveSpace();
  const identity = useOnlineIdentity();
  const enabled = !!identity && space?.id === spaceId && space?.sharingState === 'SHARED';
  const query = useQuery({ queryKey: [SCREEN_NOTIFICATIONS_KEY, spaceId, identity?.actorId],
    queryFn: async ({ signal }) => {
      const page = await api<{ notifications: ServerNotification[] }>('GET', '/notifications?limit=100', undefined, { signal });
      return page.notifications.filter((n) => n.space_id === spaceId && n.resource_ref?.type === 'screen_time').map((n): NotificationRow => ({
        id: n.id, spaceId: n.space_id, type: n.type, titleSafe: n.title_safe,
        resourceRef: n.resource_ref, createdAt: n.created_at, readAt: n.read_at,
      }));
    }, enabled,
    retry: false, staleTime: 15_000, gcTime: 0, refetchInterval: 60_000 });
  return { ...query, data: enabled ? query.data : undefined };
}

/** The active Space's notifications plus app-wide ones, newest first. */
export function useNotifications(spaceId: string | undefined): { loading: boolean; rows: NotificationRow[] } {
  const rows = useLiveQuery(() => (spaceId ? listNotifications({ spaceId }) : []), [spaceId]);
  const remote = useScreenNotifications(spaceId);
  const server = remote.isError ? [] : remote.data ?? [];
  return { loading: rows === undefined, rows: [...(rows ?? []), ...server].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

export function useUnreadCount(spaceId: string | undefined): number {
  const local = useLiveQuery(() => (spaceId ? unreadCount(spaceId) : 0), [spaceId]) ?? 0;
  const remote = useScreenNotifications(spaceId);
  return local + (remote.isError ? 0 : remote.data?.filter((n) => n.readAt === null).length ?? 0);
}
