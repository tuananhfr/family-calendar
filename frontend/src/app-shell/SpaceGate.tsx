"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const setStatus = useShellStore((s) => s.setStatus);
  const open = OPEN_ROUTES.has(pathname.replace(/\/$/, ""));

  useEffect(() => {
    if (!loading && !space && !open) router.replace(ROUTES.onboarding);
  }, [loading, space, open, router]);

  useEffect(() => {
    setStatus({
      spaceName: space?.name ?? null,
      dataMode: space?.sharingState === "SHARED" ? "shared" : "local",
    });
  }, [space, setStatus]);

  if (open) return <>{children}</>;
  if (loading || !space) return <SkeletonList rows={4} />;
  return <>{children}</>;
}
