"use client";

import { useMemo, useState } from "react";
import { Check, Image as ImageIcon, Paperclip, Search, X } from "lucide-react";
import type { Category } from "@/core/model/common";
import type { StoredFile } from "@/core/model/storage";
import { cn } from "@/design/cn";
import { Button, controlClass, Dialog, Tabs } from "@/design/components";
import { t } from "@/i18n/vi";
import { useStorage } from "../hooks/useStorage";
import { useUpload } from "../hooks/useUpload";
import { filterFiles } from "../model/storage-view";
import { FileThumb } from "./FileThumb";
import { UploadDropzone } from "./UploadDropzone";

/** modules.md item.attachments: at most 20 file ids. */
export const MAX_ATTACHMENTS = 20;

function PickDialog({ value, imagesOnly, category, onClose, onConfirm }: { value: string[]; imagesOnly: boolean; category?: Category; onClose: () => void; onConfirm: (ids: string[]) => void }) {
  const store = useStorage();
  const { upload, pending } = useUpload(store.spaceId, store.folders);
  const [tab, setTab] = useState<"pick" | "upload">("pick");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>(value);
  const pool = useMemo(() => filterFiles(store.files, store.folders, { tab: imagesOnly ? "IMAGE" : "ALL", query, sort: "NEWEST" }), [store.files, store.folders, imagesOnly, query]);
  const full = picked.length >= MAX_ATTACHMENTS;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_ATTACHMENTS ? p : [...p, id]));
  const uploaded = async (files: File[]) => {
    const saved = await upload(files, { category });
    if (saved.length === 0) return;
    // Fresh uploads are what the person came for: select them and show them in the list.
    setPicked((p) => [...p, ...saved.map((f) => f.id).filter((id) => !p.includes(id))].slice(0, MAX_ATTACHMENTS));
    setTab("pick");
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon={imagesOnly ? <ImageIcon /> : <Paperclip />}
      title={t("storage.attach.title")}
      footer={
        <>
          <span className="mr-auto text-sm text-muted" aria-live="polite">
            {t("storage.attach.selected", { n: picked.length })}
          </span>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => onConfirm(picked)}>{t("storage.attach.confirm")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Tabs
          label={t("storage.attach.title")}
          value={tab}
          onValueChange={(v) => setTab(v as "pick" | "upload")}
          items={[
            { value: "pick", label: t("storage.attach.fromStorage") },
            { value: "upload", label: t("storage.attach.uploadNew") },
          ]}
        />
        {tab === "upload" ? (
          store.canEdit ? (
            <UploadDropzone onFiles={(fs) => void uploaded(fs)} pending={pending} accept={imagesOnly ? "image/*" : undefined} />
          ) : (
            <p className="text-sm text-muted">{t("storage.upload.readOnly")}</p>
          )
        ) : (
          <>
            <label className="relative flex items-center">
              <span className="sr-only">{t("storage.searchLabel")}</span>
              <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("storage.search")} className={cn(controlClass, "pl-9")} />
            </label>
            {full ? <p className="text-sm text-muted">{t("storage.attach.limit", { n: MAX_ATTACHMENTS })}</p> : null}
            {pool.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{query ? t("storage.empty.searchTitle") : t("storage.empty.title")}</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="attach-pool">
                {pool.map((f) => {
                  const on = picked.includes(f.id);
                  return (
                    <li key={f.id} className="min-w-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={f.name}
                        disabled={!on && full}
                        onClick={() => toggle(f.id)}
                        className={cn(
                          "relative flex w-full flex-col gap-1 rounded-control border-2 p-1 text-left transition-colors disabled:opacity-50",
                          on ? "border-primary bg-primary-soft" : "border-transparent hover:border-border",
                        )}
                      >
                        <FileThumb file={f} />
                        <span className="truncate px-0.5 text-xs text-text">{f.name}</span>
                        {on ? (
                          <span aria-hidden className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-on-primary">
                            <Check className="size-4" />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

/** "Đính kèm file/ảnh" in the item form: chips of what is attached + a picker from Kho or a fresh upload into the category's folder. */
export function AttachmentPicker({
  value,
  onChange,
  imagesOnly = false,
  category,
  label,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  imagesOnly?: boolean;
  category?: Category;
  label: string;
}) {
  const store = useStorage();
  const [open, setOpen] = useState(false);
  const byId = new Map(store.files.map((f) => [f.id, f]));
  const attached = value.map((id) => byId.get(id)).filter((f): f is StoredFile => !!f);

  return (
    <div className="contents">
      <Button variant="secondary" size="sm" icon={imagesOnly ? <ImageIcon className="size-4" /> : <Paperclip className="size-4" />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {attached.length > 0 ? (
        <ul className="order-last flex basis-full flex-wrap gap-2" aria-label={t("storage.attach.list")} data-testid="attachment-chips">
          {attached.map((f) => (
            <li key={f.id} className="flex max-w-full items-center gap-2 rounded-control border border-border bg-surface py-1 pl-1 pr-1">
              <FileThumb file={f} size="chip" />
              <span className="max-w-[12rem] truncate text-sm text-text">{f.name}</span>
              <button
                type="button"
                aria-label={t("storage.attach.remove", { name: f.name })}
                onClick={() => onChange(value.filter((id) => id !== f.id))}
                className="flex size-8 items-center justify-center rounded-control text-muted hover:bg-danger-soft hover:text-danger"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <PickDialog
          value={value}
          imagesOnly={imagesOnly}
          category={category}
          onClose={() => setOpen(false)}
          onConfirm={(ids) => {
            // Ids the viewer can't see (another member's private file) stay attached untouched.
            const hidden = value.filter((id) => !byId.has(id));
            onChange([...hidden, ...ids].slice(0, MAX_ATTACHMENTS));
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
