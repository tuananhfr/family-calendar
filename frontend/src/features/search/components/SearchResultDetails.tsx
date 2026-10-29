"use client";
import { canRead, canReadItem, type AccessContext } from "@/core/access/evaluate";
import type { LocalDataView } from "@/core/repo/data-view";
import type { SearchHit } from "@/core/search";
import { Dialog } from "@/design/components";
import { FilePreviewDialog } from "@/features/storage";
import { t } from "@/i18n/vi";

export function SearchResultDetails({ hit, data, access, onClose }: { hit: SearchHit; data: LocalDataView; access: AccessContext; onClose(): void }) {
  if (hit.type === "file") {
    const file = data.files.find((row) => row.id === hit.id && !row.deletedAt && canRead(access, row, "storage"));
    if (file) return <FilePreviewDialog fileId={file.id} timeZone={data.space.timeZone} canDelete={false} onClose={onClose} />;
  }
  let fields: Array<[string, string]> = [];
  let title: string | undefined;
  if (hit.type === "item") {
    const item = data.items.find((row) => row.id === hit.id && !row.deletedAt && canReadItem(access, row));
    if (item) { title = item.title; fields = [[t("search.start"), item.schedule.start], [t("search.end"), item.schedule.end ?? ""], [t("search.notes"), item.note ?? ""], [t("category." + item.category), item.locationText ?? ""]]; }
  } else if (hit.type === "member") {
    const member = data.members.find((row) => row.id === hit.id && !row.deletedAt && (row.sharingScope !== "PRIVATE" || row.createdByActorId === access.actorId));
    if (member) { title = member.displayName; fields = [[t("search.notes"), member.note ?? ""]]; }
  } else if (hit.type === "finance_txn") {
    const transaction = data.financeTxns.find((row) => row.id === hit.id && !row.deletedAt && canRead(access, row, "finance"));
    if (transaction) { title = transaction.note || t("search.types.finance_txn"); fields = [[t("search.date"), transaction.date], [t("search.amount"), new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(transaction.amount)]]; }
  } else if (hit.type === "health_note") {
    const note = data.healthNotes.find((row) => row.id === hit.id && !row.deletedAt && canRead(access, row, "health"));
    if (note) { title = note.title; fields = [[t("search.date"), note.date], [t("search.notes"), note.body]]; }
  }
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title={title ?? t("search.details")} size="md">{title ? <dl className="flex flex-col gap-4">{fields.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-muted">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm text-text">{value}</dd></div>)}</dl> : <p className="text-sm text-body">{t("search.recordUnavailable")}</p>}{hit.type === "health_note" && <p className="mt-4 text-xs text-muted">{t("search.sensitive")}</p>}</Dialog>;
}
