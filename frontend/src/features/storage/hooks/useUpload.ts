"use client";

import { useState } from "react";
import { StorageFullError } from "@/core/db/errors";
import type { Category } from "@/core/model/common";
import type { Folder, StoredFile } from "@/core/model/storage";
import { markBusy } from "@/core/platform/busy-guard";
import { toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { kindOfFile } from "../model/file-kind";
import { FileTooLargeError, ingestFile } from "../model/ingest";
import { uploadTarget, type StorageTab } from "../model/storage-view";

export interface UploadContext {
  folderId?: string;
  tab?: StorageTab;
  category?: Category;
}

/** Saves picked/dropped files one by one; each failure is reported by name and does not stop the rest. */
export function useUpload(spaceId: string | undefined, folders: Folder[]) {
  const [pending, setPending] = useState(0);

  const upload = async (files: File[], ctx: UploadContext = {}): Promise<StoredFile[]> => {
    if (files.length === 0) return [];
    if (!spaceId || folders.length === 0) {
      toast(t("storage.upload.noFolder"), "error");
      return [];
    }
    setPending(files.length);
    // An update reload mid-write would drop the file being stored.
    const release = markBusy("upload");
    const saved: StoredFile[] = [];
    let lowSpace = false;
    try {
      for (const file of files) {
        const folderId = uploadTarget(folders, { ...ctx, kind: kindOfFile(file) });
        try {
          const res = await ingestFile(spaceId, folderId!, file);
          saved.push(res.file);
          lowSpace ||= res.warnLowSpace;
        } catch (error) {
          const reason = error instanceof StorageFullError ? t("storage.upload.full") : error instanceof FileTooLargeError ? error.message : "";
          if (!reason) console.error(error);
          toast(`${t("storage.upload.failed", { name: file.name })} ${reason}`.trim(), "error");
          if (error instanceof StorageFullError) break;
        } finally {
          setPending((n) => n - 1);
        }
      }
    } finally {
      release();
      setPending(0);
    }
    if (saved.length > 0) {
      const folderIds = new Set(saved.map((f) => f.folderId));
      const only = folderIds.size === 1 ? folders.find((f) => folderIds.has(f.id)) : undefined;
      toast(only ? t("storage.upload.done", { n: saved.length, folder: only.name }) : t("storage.upload.doneMany", { n: saved.length }), "success");
    }
    if (lowSpace) toast(t("storage.upload.lowSpace"));
    return saved;
  };

  return { upload, pending };
}
