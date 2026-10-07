"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useStorage } from "../hooks/useStorage";
import { t } from "@/i18n/vi";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { FileThumb } from "./FileThumb";

/** Attachments in "Chi tiết": readable files as thumbnails that open the preview; the rest are only counted, never named. */
export function AttachmentStrip({ ids }: { ids: string[] }) {
  const store = useStorage();
  const [open, setOpen] = useState<string>();
  if (ids.length === 0 || store.loading) return null;
  const byId = new Map(store.files.map((f) => [f.id, f]));
  const files = ids.map((id) => byId.get(id)).filter((f) => !!f);
  const hidden = ids.length - files.length;
  const openFile = open ? byId.get(open) : undefined;

  return (
    <div className="flex flex-col gap-2" data-testid="attachment-strip">
      <span className="text-sm font-semibold text-text">{t("storage.attach.list")}</span>
      <ul className="flex flex-wrap gap-2">
        {files.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => setOpen(f.id)}
              aria-label={t("storage.attach.open", { name: f.name })}
              className="flex w-24 flex-col gap-1 rounded-control p-1 text-left hover:bg-primary-soft"
            >
              <FileThumb file={f} />
              <span className="truncate text-xs text-body">{f.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Lock aria-hidden className="size-3.5" />
          {t("storage.attach.hidden", { n: hidden })}
        </p>
      ) : null}
      {openFile ? <FilePreviewDialog fileId={openFile.id} timeZone={store.timeZone} canDelete={false} onClose={() => setOpen(undefined)} /> : null}
    </div>
  );
}
