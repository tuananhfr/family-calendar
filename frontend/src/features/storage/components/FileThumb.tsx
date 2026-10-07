"use client";

import { File as FileIcon, FileText, Film, Image as ImageIcon, Music } from "lucide-react";
import type { FileKind, StoredFile } from "@/core/model/storage";
import { cn } from "@/design/cn";
import { useBlobUrl } from "@/features/members";
import { extensionLabel } from "../model/file-kind";

const KIND_ICON = { IMAGE: ImageIcon, DOCUMENT: FileText, VIDEO: Film, AUDIO: Music, OTHER: FileIcon } as const;

// Badge colours follow the mockup (jpg purple, pdf red, mp4 blue); text uses the surface colour so it flips with the theme.
const BADGE_BG: Record<FileKind, string> = {
  IMAGE: "bg-[var(--cat-housework-dot)]",
  DOCUMENT: "bg-danger",
  VIDEO: "bg-primary",
  AUDIO: "bg-[var(--cat-finance-dot)]",
  OTHER: "bg-[var(--cat-other-dot)]",
};

export function ExtensionBadge({ file, className }: { file: Pick<StoredFile, "name" | "kind">; className?: string }) {
  const ext = extensionLabel(file.name);
  if (!ext) return null;
  return <span className={cn("rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold lowercase leading-none text-surface", BADGE_BG[file.kind], className)}>{ext}</span>;
}

/** Thumbnail when the device made one, else the kind icon; the extension badge sits bottom-right like IMG-F. */
export function FileThumb({ file, size = "tile", className }: { file: StoredFile; size?: "tile" | "row" | "chip"; className?: string }) {
  const url = useBlobUrl(file.thumbnailBlobId);
  const Icon = KIND_ICON[file.kind];
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-surface-2 text-muted",
        size === "tile" ? "aspect-[4/3] w-full rounded-control" : size === "row" ? "size-11 rounded-control" : "size-9 rounded-[8px]",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL, next/image cannot optimise it
        <img src={url} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <Icon aria-hidden className={size === "tile" ? "size-10" : "size-5"} strokeWidth={1.5} />
      )}
      {size === "tile" ? <ExtensionBadge file={file} className="absolute bottom-1.5 right-1.5" /> : null}
    </span>
  );
}
