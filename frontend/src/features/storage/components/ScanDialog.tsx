"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Camera, ImagePlus, ScanLine, X } from "lucide-react";
import { Button, Dialog, IconButton, TextField } from "@/design/components";
import { t } from "@/i18n/vi";
import { scanPagesToPdf } from "../model/scan-to-pdf";

function todayLabel(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  // Dashes, not slashes: the name becomes a file name.
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** "Quét tài liệu": photograph 1..n pages, reorder or drop them, then one A4 PDF is built on the device (no OCR). */
export function ScanDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (pdf: File) => Promise<unknown> }) {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<File[]>([]);
  const [name, setName] = useState(() => t("storage.scan.defaultName", { date: todayLabel() }));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const urls = useMemo(() => pages.map((p) => URL.createObjectURL(p)), [pages]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = (files: FileList | null) => {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || f.type === "");
    if (images.length === 0) return;
    setPages((p) => [...p, ...images]);
    setError(undefined);
  };
  const move = (i: number) => setPages((p) => [...p.slice(0, i - 1), p[i], p[i - 1], ...p.slice(i + 1)]);

  const create = async () => {
    if (pages.length === 0) return setError(t("storage.scan.noPages"));
    setBusy(true);
    try {
      const pdf = await scanPagesToPdf(pages);
      const base = name.trim() || t("storage.scan.defaultName", { date: todayLabel() });
      await onCreate(new File([pdf], base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`, { type: "application/pdf" }));
      setPages([]);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setError(t("storage.scan.unsupported"));
    } finally {
      setBusy(false);
    }
  };

  const input = (ref: typeof camera, label: string, capture: boolean) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple={!capture}
      {...(capture ? { capture: "environment" as const } : {})}
      className="sr-only"
      tabIndex={-1}
      aria-label={label}
      onChange={(e) => {
        add(e.target.files);
        e.target.value = "";
      }}
    />
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<ScanLine />}
      title={t("storage.scan.title")}
      description={t("storage.scan.body")}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void create()} loading={busy} disabled={pages.length === 0}>
            {t("storage.scan.create", { n: pages.length })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {input(camera, t("storage.scan.pageInputLabel"), true)}
        {input(picker, t("storage.scan.addFromFile"), false)}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Camera className="size-4" />} onClick={() => camera.current?.click()}>
            {t("storage.scan.addPage")}
          </Button>
          <Button variant="ghost" icon={<ImagePlus className="size-4" />} onClick={() => picker.current?.click()}>
            {t("storage.scan.addFromFile")}
          </Button>
        </div>
        {pages.length > 0 ? (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="scan-pages">
            {pages.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex min-w-0 flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                <img src={urls[i]} alt={t("storage.scan.page", { n: i + 1 })} className="aspect-[3/4] w-full rounded-control border border-border bg-surface-2 object-cover" />
                <div className="flex items-center justify-between">
                  <span className="pl-1 text-xs text-muted">{t("storage.scan.page", { n: i + 1 })}</span>
                  <span className="flex">
                    {i > 0 ? <IconButton label={t("storage.scan.moveUp", { n: i + 1 })} icon={<ArrowUp className="size-4" />} onClick={() => move(i)} /> : null}
                    <IconButton label={t("storage.scan.removePage", { n: i + 1 })} icon={<X className="size-4" />} onClick={() => setPages((ps) => ps.filter((_, j) => j !== i))} />
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        <TextField label={t("storage.scan.name")} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
