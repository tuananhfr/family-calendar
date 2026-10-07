"use client";

import { useMemo } from "react";
import { useAccess } from "@/features/members";
import { visibleNav, type NavItem } from "./nav-config";

export function useVisibleNav(items: NavItem[]): NavItem[] {
  const access = useAccess();
  return useMemo(() => visibleNav(items, access), [items, access]);
}
