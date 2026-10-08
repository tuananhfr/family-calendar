"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";
import { AccessLossPanel } from "@/features/sharing/components/AccessLossPanel";
import { useSyncStatus } from "@/core/sync/sync-status";
import { SkeletonList } from "@/design/components";
import { useActiveSpace } from "@/features/members";
import { ROUTES } from "./nav-config";
import { useShellStore } from "./shell-store";

// Footer pages must stay readable before onboarding (privacy policy, terms, help).
const OPEN_ROUTES = new Set<string>([ROUTES.about, ROUTES.terms, ROUTES.privacy, ROUTES.contact, ROUTES.help].map((r) => r.replace(/\/$/, "")));

/** Sends a device without any family to onboarding and mirrors the active Space into the shell header. */
export function SpaceGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { space, loading } = useActiveSpace();
  const lost = useLiveQuery(async () => {
    const copies = await db.spaces.where("sharingState").equals("SHARED").filter((s) => !!s.deletedAt).toArray();
    copies.sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
    return copies[0] ? await db.syncCursors.get(copies[0].id) ?? null : null;
  }, []);
  const status = useSyncStatus(space?.id);
  const setStatus = useShellStore((s) => s.setStatus);
  const open = OPEN_ROUTES.has(pathname.replace(/\/$/, ""));

  useEffect(() => {
    if (!loading && !space && !open && lost === null) router.replace(ROUTES.onboarding);
  }, [loading, space, open, router, lost]);

  useEffect(() => {
    setStatus({
      spaceName: space?.name ?? null,
      dataMode: space?.sharingState !== "SHARED" ? "local" : ({ SYNCED: "synced", PENDING: "pending", SYNCING: "pending", OFFLINE: "offline", CONFLICT: "conflict", BLOCKED: "blocked", AUTH_REQUIRED: "authRequired" } as const)[status.state],
      pendingOps: status.pending,
    });
  }, [space, setStatus, status.state, status.pending]);

  if (open) return <>{children}</>;
  if (!loading && !space && lost) return <AccessLossPanel revoked={["SPACE_ACCESS_REVOKED", "DEVICE_REVOKED"].includes(lost.haltCode ?? "")} />;
  if (loading || !space) return <SkeletonList rows={4} />;
  return <>{children}</>;
}
