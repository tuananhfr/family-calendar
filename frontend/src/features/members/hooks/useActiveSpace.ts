"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { listSpaces } from "@/core/repo/read";
import type { Space } from "@/core/model/space";
import { useAppStore } from "@/store/app.store";

export interface ActiveSpace {
  space: Space | undefined;
  spaces: Space[];
  /** True until IndexedDB has answered; never treat "loading" as "no family yet". */
  loading: boolean;
  setActive(id: string): void;
}

export function useActiveSpace(): ActiveSpace {
  const activeSpaceId = useAppStore((s) => s.activeSpaceId);
  const setActive = useAppStore((s) => s.setActiveSpaceId);
  const spaces = useLiveQuery(() => listSpaces(), []);
  const list = spaces ?? [];
  // A stale id (space deleted or data cleared) falls back to the family space instead of an empty screen.
  const space = list.find((s) => s.id === activeSpaceId) ?? list.find((s) => s.kind === "FAMILY") ?? list[0];
  return { space, spaces: list, loading: spaces === undefined, setActive };
}
