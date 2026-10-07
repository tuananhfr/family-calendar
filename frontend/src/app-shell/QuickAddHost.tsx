"use client";

import { ItemEditorHost } from "@/features/items";
import { useShellStore } from "./shell-store";

/** Bridges the shell's "+ Thêm mới" buttons (sidebar, bottom nav) to the item editor. */
export function QuickAddHost() {
  const open = useShellStore((s) => s.quickAddOpen);
  const setOpen = useShellStore((s) => s.setQuickAddOpen);
  return <ItemEditorHost quickAdd={open} onQuickAddChange={setOpen} />;
}
