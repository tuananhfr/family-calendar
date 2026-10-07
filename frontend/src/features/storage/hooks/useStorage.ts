"use client";

import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { canDelete, canRead, hasLevel } from "@/core/access/evaluate";
import type { Folder, StoredFile } from "@/core/model/storage";
import { listActive } from "@/core/repo/read";
import { useAccess, useActiveSpace } from "@/features/members";
import { ensureSystemFolders } from "../model/system-folders";

export interface StorageView {
  loading: boolean;
  spaceId?: string;
  timeZone: string;
  folders: Folder[];
  files: StoredFile[];
  canEdit: boolean;
  canDeleteFile: (f: StoredFile) => boolean;
}

/** Folders and files the viewer may read; the six system folders are made on first use (idempotent, cross-tab safe). */
export function useStorage(): StorageView {
  const { space } = useActiveSpace();
  const spaceId = space?.id;
  const access = useAccess();
  useEffect(() => {
    if (spaceId) ensureSystemFolders(spaceId).catch(console.error);
  }, [spaceId]);
  const data = useLiveQuery(async () => (spaceId ? { folders: await listActive<Folder>("folder", spaceId), files: await listActive<StoredFile>("file", spaceId) } : null), [spaceId]);

  return useMemo(() => {
    const timeZone = space?.timeZone ?? "Asia/Ho_Chi_Minh";
    if (!data || !access) return { loading: true, spaceId, timeZone, folders: [], files: [], canEdit: false, canDeleteFile: () => false };
    return {
      loading: false,
      spaceId,
      timeZone,
      folders: data.folders.filter((f) => canRead(access, f, "storage")),
      files: data.files.filter((f) => canRead(access, f, "storage")),
      canEdit: hasLevel(access, "storage", "EDIT"),
      canDeleteFile: (f: StoredFile) => canDelete(access, f, "storage"),
    };
  }, [data, access, spaceId, space?.timeZone]);
}
