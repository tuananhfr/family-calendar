"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";
import { readMediaStatus } from "@/core/sync/media-status";
import { Button, Checkbox } from "@/design/components";
import { t } from "@/i18n/vi";
export function MediaPanel({ spaceId }: { spaceId: string }) {
  const status = useLiveQuery(() => readMediaStatus(spaceId), [spaceId]);
  const options = useLiveQuery(() => db.settings.get("media-options:" + spaceId), [spaceId]);
  const value = options?.value as { includeFiles: boolean; includeAudio: boolean } | undefined;
  const [error, setError] = useState(false);
  const setOption = async (key: "includeFiles" | "includeAudio", next: boolean) => {
    setError(false);
    try {
      await db.settings.put({ key: "media-options:" + spaceId, value: { includeFiles: value?.includeFiles ?? true, includeAudio: value?.includeAudio ?? true, [key]: next } });
      const rows = await db.settings.filter((row) => row.key.startsWith("media:" + spaceId + "/") && (row.value as { state?: string }).state === "EXCLUDED").toArray();
      await db.settings.bulkDelete(rows.map((row) => row.key));
    } catch { setError(true); }
  };
  return <section className="flex flex-col gap-3 border-t border-border pt-4">
    <h3 className="font-semibold text-text">{t("sharing.mediaTitle")}</h3>
    {status?.pending ? <p className="text-sm text-muted" role="status">{t("sharing.mediaPending")} ({status.pending})</p> : null}
    {status?.excluded ? <p className="text-sm text-muted">{t("sharing.mediaExcluded")} ({status.excluded})</p> : null}
    <Checkbox label={t("sharing.includeFiles")} checked={value?.includeFiles ?? true} onCheckedChange={(v) => void setOption("includeFiles", v === true)} />
    <Checkbox label={t("sharing.includeAudio")} checked={value?.includeAudio ?? true} onCheckedChange={(v) => void setOption("includeAudio", v === true)} />
    <p className="text-xs text-muted">{t("sharing.mediaChoiceHint")} {t("sharing.mediaUploadedHint")}</p>
    {status?.pending ? <Button size="sm" variant="secondary" onClick={async () => {
      const rows = await db.settings.filter((row) => row.key.startsWith("media:" + spaceId + "/") && (row.value as { state?: string }).state === "MISSING").toArray();
      await db.settings.bulkDelete(rows.map((row) => row.key));
    }}>{t("sharing.retryMedia")}</Button> : null}
    {error ? <p className="text-sm text-danger" role="alert">{t("sharing.error")}</p> : null}
  </section>;
}
