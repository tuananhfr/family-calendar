"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/core/api/client";
import { useOnlineIdentity } from "./useOnlineIdentity";

export interface LinkedAccount { linked: boolean; email?: string }

export function useLinkedAccount() {
  const identity = useOnlineIdentity();
  const account = useQuery({
    queryKey: ["account", identity?.actorId],
    queryFn: () => api<LinkedAccount>("GET", "/account"),
    enabled: !!identity,
    // The email link is usually confirmed in another tab; refresh when the user comes back.
    refetchOnWindowFocus: true,
  });
  return { identity, account };
}
