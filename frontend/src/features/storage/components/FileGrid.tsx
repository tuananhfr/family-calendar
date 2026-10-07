"use client";

import type { StoredFile } from "@/core/model/storage";
import { cn } from "@/design/cn";
import { fileDate } from "../model/file-label";
import { FileThumb } from "./FileThumb";

/** IMG-F "Tệp gần đây": thumbnail tiles, two-line name, date. */
export function FileGrid({ files, timeZone, onOpen, className }: { files: StoredFile[]; timeZone: string; onOpen: (f: StoredFile) => void; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6", className)} data-testid="file-grid">
      {files.map((f) => (
        <li key={f.id} className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen(f)}
            className="flex w-full min-w-0 flex-col gap-2 rounded-card p-2 text-left transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft"
            data-testid="file-tile"
          >
            <FileThumb file={f} />
            <span className="flex min-w-0 flex-col gap-0.5 px-0.5">
              <span className="line-clamp-2 break-words text-sm font-semibold text-text" title={f.name}>
                {f.name}
              </span>
              <span className="text-xs text-muted tabular-nums">{fileDate(f.createdAt, timeZone)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
