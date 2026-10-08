"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";
import { Button } from "@/design/components";
import { t } from "@/i18n/vi";
import { resolveConflict } from "../model/conflicts";
function Summary({ value }: { value: unknown }) {
  const record = value as Record<string, unknown> | null;
  if (!record) return <p className="text-sm text-muted">{t("sharing.noServer")}</p>;
  const schedule = record.schedule as { start?: string; end?: string } | undefined;
  return <div className="flex flex-col gap-1 text-sm text-body">
    <p className="break-words font-semibold text-text">{String(record.title ?? record.name ?? record.displayName ?? "")}</p>
    {schedule?.start ? <p>{schedule.start.replace("T", " ")}{schedule.end ? " — " + schedule.end.replace("T", " ") : ""}</p> : null}
    {["note", "notes", "description", "amount", "date", "value"].map((key) => typeof record[key] === "string" || typeof record[key] === "number" ? <p key={key} className="break-words">{String(record[key])}</p> : null)}
  </div>;
}
export function ConflictPanel({ spaceId }: { spaceId: string }) {
  const ops = useLiveQuery(() => db.outbox.where("spaceId").equals(spaceId).filter((o) => o.state === "CONFLICT" || o.state === "INVALID").toArray(), [spaceId]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  if (!ops?.length) return null;
  return <section className="flex flex-col gap-4 border-t border-border pt-4">
    <h3 className="font-semibold text-text">{t("sharing.conflicts")}</h3>
    <p className="text-xs text-muted">{t("sharing.conflictHint")}</p>
    {ops.map((op) => <div key={op.operationId} className="flex flex-col gap-3 rounded-control border border-border p-3">
      <div className="grid gap-4 md:grid-cols-2">
        <div><p className="mb-2 text-xs text-muted">{t("sharing.localVersion")}</p><Summary value={op.payload} /></div>
        <div><p className="mb-2 text-xs text-muted">{t("sharing.serverVersion")}</p><Summary value={op.conflictCurrent} /></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["server", "local"] as const).map((choice) => <Button key={choice} size="sm" variant={choice === "local" ? "primary" : "secondary"} loading={busy === op.operationId} disabled={choice === "local" && !op.conflictCurrent} onClick={async () => {
          setBusy(op.operationId); setError(undefined);
          try { await resolveConflict(op.operationId, choice); }
          catch { setError(t("sharing.error")); } finally { setBusy(undefined); }
        }}>{t(choice === "local" ? "sharing.retryLocal" : "sharing.keepServer")}</Button>)}
      </div>
    </div>)}
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
  </section>;
}
