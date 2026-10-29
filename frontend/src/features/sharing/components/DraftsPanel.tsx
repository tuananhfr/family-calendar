"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";
import { Button } from "@/design/components";
import { t } from "@/i18n/vi";
export function DraftsPanel() {
  const drafts = useLiveQuery(() => db.sharedDrafts.toArray(), []);
  const emergencies = useLiveQuery(() => db.emergencyDrafts.toArray(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const count = (drafts?.length ?? 0) + (emergencies?.length ?? 0);
  if (!count) return null;
  return <section className="flex flex-col gap-3 border-t border-border pt-4">
    <h3 className="font-semibold text-text">{t("sharing.savedDrafts")} ({count})</h3>
    <p className="text-sm text-body">{t("sharing.savedDraftsHint")}</p>
    <Button variant="secondary" loading={busy} onClick={async () => {
      setBusy(true); setError(false);
      try {
        const { zipSync, strToU8 } = await import("fflate");
        const entries: Record<string, Uint8Array> = {};
        for (const draft of drafts ?? []) {
          entries[draft.id + "/record.json"] = strToU8(JSON.stringify({ record: draft.record, operation: draft.operation }, null, 2));
          for (const blob of draft.media ?? []) entries[draft.id + "/media/" + blob.id] = new Uint8Array(await blob.data.arrayBuffer());
          entries[draft.id + "/media.json"] = strToU8(JSON.stringify((draft.media ?? []).map(({ data, ...meta }) => { void data; return meta; }), null, 2));
        }
        for (const draft of emergencies ?? []) entries["sos/" + draft.id + "/event.json"] = strToU8(JSON.stringify({ event: draft.event, reason: draft.reason }, null, 2));
        const zipped = zipSync(entries);
        const url = URL.createObjectURL(new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" }));
        const link = document.createElement("a"); link.href = url; link.download = "family-calendar-drafts.zip"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch { setError(true); } finally { setBusy(false); }
    }}>{t("sharing.downloadDrafts")}</Button>
    {error ? <p role="alert" className="text-sm text-danger">{t("sharing.error")}</p> : null}
  </section>;
}
