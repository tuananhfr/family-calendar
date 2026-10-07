"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, File as FileIcon, MapPinOff, Trash2 } from "lucide-react";
import { db } from "@/core/db/db";
import { formatBytes } from "@/core/format/bytes";
import type { Folder, StoredFile } from "@/core/model/storage";
import { getActive } from "@/core/repo/read";
import { saveBlob } from "@/core/platform/download";
import { Button, Dialog, SkeletonList, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { deleteStoredFile } from "../model/file-actions";
import { fileDateTime, takenLabel } from "../model/file-label";
import { ExtensionBadge } from "./FileThumb";

/** Object URL of the full file; revoked on change/unmount. `null` = record exists but its bytes are not on this device. */
function useFileUrl(fileId: string): { url?: string; blob?: Blob; missing: boolean } {
  const row = useLiveQuery(
    async () =>
      (await db.blobs
        .where("fileId")
        .equals(fileId)
        .filter((b) => b.kind === "FILE")
        .first()) ?? null,
    [fileId],
  );
  const url = useMemo(() => (row ? URL.createObjectURL(row.data) : undefined), [row]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return { url, blob: row?.data, missing: row === null };
}

function Body({ file, url, missing }: { file: StoredFile; url?: string; missing: boolean }) {
  if (missing) return <p className="py-10 text-center text-sm text-muted">{t("storage.preview.missing")}</p>;
  if (!url) return <SkeletonList rows={3} />;
  const frame = "max-h-[60dvh] w-full rounded-control bg-surface-2";
  if (file.kind === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element -- local object URL, next/image cannot optimise it
    return <img src={url} alt={file.name} className={`${frame} object-contain`} />;
  }
  if (file.mime === "application/pdf") return <iframe src={url} title={t("storage.preview.pdfTitle", { name: file.name })} className={`${frame} h-[60dvh] border border-border`} />;
  if (file.kind === "VIDEO") return <video src={url} controls playsInline className={frame} />;
  if (file.kind === "AUDIO") return <audio src={url} controls className="w-full" />;
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <FileIcon aria-hidden className="size-12 text-muted" strokeWidth={1.5} />
      <p className="max-w-[40ch] text-sm text-muted">{t("storage.preview.noPreview")}</p>
    </div>
  );
}

/** Preview of one stored file: image, PDF (blob iframe), video, audio; download and delete for those who may. */
export function FilePreviewDialog({ fileId, timeZone, canDelete, onClose }: { fileId: string; timeZone: string; canDelete: boolean; onClose: () => void }) {
  const data = useLiveQuery(async () => {
    const file = await getActive<StoredFile>("file", fileId);
    return file ? { file, folder: await getActive<Folder>("folder", file.folderId) } : null;
  }, [fileId]);
  const { url, blob, missing } = useFileUrl(fileId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (data === null) return null;
  const file = data?.file;

  const remove = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await deleteStoredFile(file.id);
      toast(t("storage.preview.deleted", { name: file.name }), "success");
      onClose();
    } catch (error) {
      console.error(error);
      toast(t("storage.preview.deleteFailed"), "error");
      setBusy(false);
    }
  };

  if (confirming && file) {
    return (
      <Dialog
        open
        size="sm"
        onOpenChange={(o) => !o && setConfirming(false)}
        icon={<Trash2 />}
        title={t("storage.preview.delete")}
        description={t("storage.preview.deleteConfirm", { name: file.name })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={() => void remove()} loading={busy}>
              {t("common.delete")}
            </Button>
          </>
        }
      />
    );
  }

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      title={file?.name ?? ""}
      description={file && data?.folder ? data.folder.name : undefined}
      footer={
        file ? (
          <>
            {canDelete ? (
              <Button variant="ghost" className="mr-auto text-danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirming(true)}>
                {t("storage.preview.delete")}
              </Button>
            ) : null}
            <Button icon={<Download className="size-4" />} disabled={!blob} onClick={() => blob && saveBlob(blob, file.name)}>
              {t("storage.preview.download")}
            </Button>
          </>
        ) : undefined
      }
    >
      {file ? (
        <div className="flex flex-col gap-4 pb-2" data-testid="file-preview">
          <Body file={file} url={url} missing={missing} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div className="flex flex-col">
              <dt className="text-xs text-muted">{t("storage.preview.size")}</dt>
              <dd className="flex items-center gap-1.5 text-text tabular-nums">
                {formatBytes(file.size)} <ExtensionBadge file={file} />
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted">{t("storage.preview.added")}</dt>
              <dd className="text-text tabular-nums">{fileDateTime(file.createdAt, timeZone)}</dd>
            </div>
            {file.takenAt ? (
              <div className="flex flex-col">
                <dt className="text-xs text-muted">{t("storage.preview.taken")}</dt>
                <dd className="text-text tabular-nums">{takenLabel(file.takenAt)}</dd>
              </div>
            ) : null}
          </dl>
          {file.mime === "image/jpeg" ? (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <MapPinOff aria-hidden className="size-3.5" />
              {t("storage.preview.gpsRemoved")}
            </p>
          ) : null}
        </div>
      ) : (
        <SkeletonList rows={3} />
      )}
    </Dialog>
  );
}
