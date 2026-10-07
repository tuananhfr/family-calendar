"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { CloudUpload, X } from "lucide-react";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";

export interface PhotoDropProps {
  previewUrl?: string;
  error?: string;
  busy?: boolean;
  onFile: (f: File) => void;
  onClear: () => void;
}

/** Click or drag-and-drop a single photo; validation and resizing happen in the caller. */
export function PhotoDrop({ previewUrl, error, busy, onFile, onClear }: PhotoDropProps) {
  const inputId = useId();
  const errId = `${inputId}-err`;
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-semibold text-text">{t("members.form.photo")}</span>
      <div className="flex items-center gap-3">
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex min-h-[var(--touch-min)] flex-1 cursor-pointer items-center gap-3 rounded-control border border-dashed px-3 py-2.5 text-sm transition-colors",
            over ? "border-primary bg-primary-soft" : "border-border-strong bg-surface hover:border-primary",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <CloudUpload aria-hidden className="size-6 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block font-medium text-primary">{t("members.form.photoPick")}</span>
            <span className="block text-xs text-muted">{t("members.form.photoHint")}</span>
          </span>
        </label>
        {previewUrl ? (
          <span className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, nothing for next/image to optimise */}
            <img src={previewUrl} alt="" className="size-14 rounded-full object-cover" />
            <button
              type="button"
              onClick={onClear}
              aria-label={t("members.form.photoRemove")}
              className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-danger"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </span>
        ) : null}
      </div>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-describedby={error ? errId : undefined}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          // Allow re-picking the same file after clearing it.
          e.target.value = "";
        }}
      />
      {error ? (
        <p id={errId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
