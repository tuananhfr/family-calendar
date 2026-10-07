"use client";

import { Folder as FolderIcon, Lock } from "lucide-react";
import type { Folder } from "@/core/model/storage";
import { t } from "@/i18n/vi";

/** The folder tiles of IMG-F: yellow folder, name, item count; sensitive folders carry a lock. */
export function FolderGrid({ folders, counts, onOpen }: { folders: Folder[]; counts: Map<string, number>; onOpen: (f: Folder) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="folder-grid">
      {folders.map((f) => (
        <li key={f.id} className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen(f)}
            className="flex h-full w-full min-w-0 flex-col items-center gap-1.5 rounded-card border border-border bg-surface px-3 pb-3 pt-4 text-center shadow-sm transition-colors hover:border-primary hover:bg-primary-soft"
            data-testid="folder-tile"
          >
            <span className="relative">
              <FolderIcon aria-hidden className="size-12 fill-[var(--folder-fill)] text-[var(--folder-fill)]" strokeWidth={1.25} />
              {f.dataClass === "SENSITIVE" ? (
                <span className="absolute -bottom-0.5 -right-1 flex size-5 items-center justify-center rounded-full bg-surface text-[var(--cat-health-dot)] shadow-sm">
                  <Lock aria-label={t("storage.locked")} className="size-3" />
                </span>
              ) : null}
            </span>
            <span className="line-clamp-2 w-full break-words text-sm font-semibold text-text">{f.name}</span>
            <span className="text-xs text-muted tabular-nums">{t("storage.itemCount", { n: counts.get(f.id) ?? 0 })}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
