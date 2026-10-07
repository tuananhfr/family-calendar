"use client";

import type { Folder, StoredFile } from "@/core/model/storage";
import { formatBytes } from "@/core/format/bytes";
import { fileDate } from "../model/file-label";
import { ExtensionBadge, FileThumb } from "./FileThumb";

/** List view: one row per file with folder, size and date; the folder column folds under the name on phones. */
export function FileList({ files, folders, timeZone, onOpen }: { files: StoredFile[]; folders: Folder[]; timeZone: string; onOpen: (f: StoredFile) => void }) {
  const names = new Map(folders.map((f) => [f.id, f.name]));
  return (
    <ul className="flex flex-col divide-y divide-border rounded-card border border-border" data-testid="file-list">
      {files.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onOpen(f)}
            className="flex w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft"
            data-testid="file-row"
          >
            <FileThumb file={f} size="row" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-text" title={f.name}>
                {f.name}
              </span>
              <span className="truncate text-xs text-muted md:hidden">
                {names.get(f.folderId)} · {formatBytes(f.size)}
              </span>
            </span>
            <ExtensionBadge file={f} className="hidden sm:inline-block" />
            <span className="hidden w-40 truncate text-sm text-body md:block">{names.get(f.folderId)}</span>
            <span className="hidden w-20 text-right text-sm text-body tabular-nums md:block">{formatBytes(f.size)}</span>
            <span className="w-24 shrink-0 text-right text-xs text-muted tabular-nums sm:text-sm">{fileDate(f.createdAt, timeZone)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
