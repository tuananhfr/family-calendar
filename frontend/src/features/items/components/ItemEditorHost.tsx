"use client";

import { useActiveSpace } from "@/features/members";
import { useItemEditor } from "../hooks/useItemEditor";
import { ItemDetailDialog } from "./ItemDetailDialog";
import { ItemEditorDialog } from "./ItemEditorDialog";

/**
 * Single mount point for the add/edit/detail dialogs. `quickAdd` is the shell's "+ Thêm mới" switch; screens use
 * useItemEditor(). Keyed by `seq` so every open starts from a fresh form.
 */
export function ItemEditorHost({ quickAdd, onQuickAddChange }: { quickAdd: boolean; onQuickAddChange: (open: boolean) => void }) {
  const { space } = useActiveSpace();
  const request = useItemEditor((s) => s.request);
  const seq = useItemEditor((s) => s.seq);
  const close = useItemEditor((s) => s.close);
  const openEdit = useItemEditor((s) => s.openEdit);
  if (!space) return null;

  if (request?.mode === "detail") {
    return (
      <ItemDetailDialog
        key={seq}
        itemId={request.itemId}
        occurrenceKey={request.occurrenceKey}
        space={space}
        onClose={close}
        onEdit={() => openEdit(request.itemId, request.occurrenceKey)}
      />
    );
  }
  if (request) return <ItemEditorDialog key={seq} target={request} space={space} onClose={close} />;
  if (quickAdd) return <ItemEditorDialog key="quick-add" target={{ mode: "create", variant: "addNew" }} space={space} onClose={() => onQuickAddChange(false)} />;
  return null;
}
