import MiniSearch from "minisearch";
import { canRead, canReadItem, type AccessContext } from "../access/evaluate";
import type { LocalDataView } from "../repo/data-view";
import type { BaseRecord } from "../sync/resource-types";
import { normalizeVi } from "./normalize";

export { normalizeVi } from "./normalize";

export type SearchHitType = "item" | "member" | "file" | "finance_txn" | "health_note";

export interface SearchHit {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle?: string;
  score: number;
}

export interface SearchOptions {
  /** Vietnamese name of a finance category ('FOOD' → 'Ăn uống'); core does not own those labels. */
  financeCategoryLabel?: (category: string) => string;
}

interface Doc {
  key: string;
  type: SearchHitType;
  id: string;
  title: string;
  subtitle: string;
  text: string;
}

// Members have no capability of their own: only the PRIVATE-creator rule applies.
function memberVisible(ctx: AccessContext, rec: BaseRecord): boolean {
  return rec.sharingScope !== "PRIVATE" || rec.createdByActorId === ctx.actorId;
}

/**
 * In-memory index over what `ctx` may read (modules.md §14); queries never leave the device. Matching ignores
 * case and Vietnamese diacritics, allows prefixes ("kh" → "khám") and one typo in longer words.
 */
export function buildSearchIndex(data: LocalDataView, ctx: AccessContext, opts: SearchOptions = {}): { search(q: string): SearchHit[] } {
  const docs: Doc[] = [];
  for (const i of data.items) {
    if (i.deletedAt !== null || !canReadItem(ctx, i)) continue;
    docs.push({ key: `item:${i.id}`, type: "item", id: i.id, title: i.title, subtitle: i.locationText ?? "", text: [i.note, i.subject, i.teacher, i.room, i.documentType].filter(Boolean).join(" ") });
  }
  for (const m of data.members) {
    if (m.deletedAt !== null || !memberVisible(ctx, m)) continue;
    docs.push({ key: `member:${m.id}`, type: "member", id: m.id, title: m.displayName, subtitle: "", text: "" });
  }
  for (const f of data.files) {
    if (f.deletedAt !== null || !canRead(ctx, f, "storage")) continue;
    docs.push({ key: `file:${f.id}`, type: "file", id: f.id, title: f.name, subtitle: "", text: "" });
  }
  for (const t of data.financeTxns) {
    if (t.deletedAt !== null || !canRead(ctx, t, "finance")) continue;
    const category = opts.financeCategoryLabel?.(t.category) ?? t.category;
    docs.push({ key: `finance_txn:${t.id}`, type: "finance_txn", id: t.id, title: t.note || category, subtitle: category, text: category });
  }
  for (const n of data.healthNotes) {
    if (n.deletedAt !== null || !canRead(ctx, n, "health")) continue;
    docs.push({ key: `health_note:${n.id}`, type: "health_note", id: n.id, title: n.title, subtitle: n.date, text: n.body });
  }

  const index = new MiniSearch<Doc>({
    idField: "key",
    fields: ["title", "subtitle", "text"],
    storeFields: ["type", "id", "title", "subtitle"],
    processTerm: (term) => normalizeVi(term) || null,
    searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: (term) => (term.length >= 5 ? 1 : 0), combineWith: "AND" },
  });
  index.addAll(docs);

  return {
    search(q: string): SearchHit[] {
      if (!normalizeVi(q)) return [];
      return index.search(q).map((r) => ({
        type: r.type as SearchHitType,
        id: r.id as string,
        title: r.title as string,
        ...(r.subtitle ? { subtitle: r.subtitle as string } : {}),
        score: r.score,
      }));
    },
  };
}
