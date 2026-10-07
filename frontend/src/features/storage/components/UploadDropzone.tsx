"use client";

import { useRef, useState, type DragEvent } from "react";
import { CloudUpload } from "lucide-react";
import { cn } from "@/design/cn";
import { Button } from "@/design/components";
import { t } from "@/i18n/vi";

/** Drag-and-drop or the picker; the button is the keyboard/touch path, the drop area is a bonus for desktops. */
export function UploadDropzone({
  onFiles,
  pending,
  accept,
  multiple = true,
  className,
}: {
  onFiles: (files: File[]) => void;
  pending: number;
  accept?: string;
  multiple?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  // dragenter/leave fire for every child; count them so the highlight doesn't flicker over the button.
  const depth = useRef(0);

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const drop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={drop}
      data-testid="upload-dropzone"
      data-over={over || undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-4 py-6 text-center transition-colors",
        over ? "border-primary bg-primary-soft" : "border-border bg-surface",
        className,
      )}
    >
      <CloudUpload aria-hidden className="size-9 text-primary" strokeWidth={1.75} />
      <p className="text-sm text-body" aria-live="polite">
        {pending > 0 ? t("storage.upload.busy", { n: pending }) : over ? t("storage.upload.dropping") : t("storage.upload.drop")}
      </p>
      <input
        ref={input}
        type="file"
        multiple={multiple}
        accept={accept}
        className="sr-only"
        aria-label={t("storage.upload.inputLabel")}
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      <Button variant="secondary" size="sm" onClick={() => input.current?.click()} loading={pending > 0}>
        {t("storage.upload.pick")}
      </Button>
      <p className="text-xs text-muted">{t("storage.upload.hint")}</p>
    </div>
  );
}
