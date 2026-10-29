"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { buildSearchIndex, type SearchHit, type SearchHitType } from "@/core/search";
import { Button, Card, EmptyState, ErrorState, ForbiddenState, PageHeader, SkeletonList, TextField } from "@/design/components";
import { useLocalProjection } from "@/features/projection/hooks/useLocalProjection";
import { FINANCE_CATEGORY_LABELS } from "@/features/finance/model/categories";
import { t } from "@/i18n/vi";
import { SearchResultDetails } from "./SearchResultDetails";

const TYPES: SearchHitType[] = ["item", "member", "file", "finance_txn", "health_note"];
export function SearchScreen() {
  const projection = useLocalProjection();
  const { data, access } = projection;
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [selected, setSelected] = useState<SearchHit>();
  const [limits, setLimits] = useState<Partial<Record<SearchHitType, number>>>({});
  const index = useMemo(() => data && access ? buildSearchIndex(data, access, { financeCategoryLabel: (category) => FINANCE_CATEGORY_LABELS[category as keyof typeof FINANCE_CATEGORY_LABELS] ?? category }) : undefined, [data, access]);
  const hits = useMemo(() => index?.search(deferred) ?? [], [index, deferred]);
  return <div className="flex flex-col gap-5"><PageHeader title={t("search.title")} subtitle={t("search.subtitle")} icon={<Search />} />
    <TextField label={t("search.query")} value={query} maxLength={200} onChange={(e) => setQuery(e.target.value)} autoFocus helper={t("search.localHint")} icon={<Search />} />
    {projection.error ? <ErrorState /> : projection.denied ? <ForbiddenState /> : projection.loading ? <SkeletonList rows={3} /> : !query.trim() ? <Card><EmptyState title={t("search.empty")} body={t("search.emptyBody")} /></Card> : !hits.length ? <Card><EmptyState title={t("search.noResults")} body={t("search.noResultsBody")} /></Card> : <>
      <p role="status" className="text-sm text-muted">{t("search.resultsCount", { n: hits.length })}</p>
      {TYPES.map((type) => { const rows = hits.filter((hit) => hit.type === type); const limit = limits[type] ?? 20; return rows.length ? <Card key={type} className="flex flex-col gap-3"><h2 className="font-bold text-text">{t(`search.types.${type}`)}</h2><ul className="divide-y divide-border">{rows.slice(0, limit).map((hit) => <li key={hit.id} className="flex min-w-0 items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="break-words font-semibold text-text">{hit.title}</p>{hit.subtitle && <p className="break-words text-sm text-muted">{hit.subtitle}</p>}</div><Button variant="secondary" size="sm" aria-label={`${t("search.details")}: ${hit.title}`} onClick={() => setSelected(hit)}>{t("search.details")}</Button></li>)}</ul>{rows.length > limit && <Button variant="secondary" className="self-start" onClick={() => setLimits((current) => ({ ...current, [type]: limit + 20 }))}>{t("search.more")}</Button>}</Card> : null; })}
    </>}
    {selected && data && access && <SearchResultDetails hit={selected} data={data} access={access} onClose={() => setSelected(undefined)} />}
  </div>;
}
