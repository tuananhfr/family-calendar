import type { Category } from "@/core/model/common";
import type { FileKind, Folder, StoredFile, SystemFolderKey } from "@/core/model/storage";
import { normalizeVi } from "@/core/search";

export const STORAGE_TABS = ["ALL", "IMAGE", "DOCUMENT", "VIDEO", "PAPERS", "HEALTH", "STUDY", "FAMILY", "OTHER"] as const;
export type StorageTab = (typeof STORAGE_TABS)[number];

export const STORAGE_SORTS = ["NEWEST", "OLDEST", "NAME", "SIZE"] as const;
export type StorageSort = (typeof STORAGE_SORTS)[number];

const KIND_TABS: Partial<Record<StorageTab, FileKind>> = { IMAGE: "IMAGE", DOCUMENT: "DOCUMENT", VIDEO: "VIDEO" };
const FOLDER_TABS: Partial<Record<StorageTab, SystemFolderKey[]>> = {
  PAPERS: ["DOCUMENTS"],
  HEALTH: ["HEALTH"],
  STUDY: ["STUDY"],
  FAMILY: ["PHOTOS", "VIDEOS"],
  OTHER: ["OTHER"],
};

/** The top-level folder a file lives under (itself for top-level folders); sub-folders are one level deep. */
function rootOf(folderId: string, byId: Map<string, Folder>): Folder | undefined {
  const f = byId.get(folderId);
  return f?.parentId ? (byId.get(f.parentId) ?? f) : f;
}

function inTab(file: StoredFile, tab: StorageTab, byId: Map<string, Folder>): boolean {
  if (tab === "ALL") return true;
  const kind = KIND_TABS[tab];
  if (kind) return file.kind === kind;
  const root = rootOf(file.folderId, byId);
  if (!root) return false;
  // Folders the family made themselves have no system key and are grouped under Khác.
  if (tab === "OTHER" && !root.systemKey) return true;
  return !!root.systemKey && (FOLDER_TABS[tab] ?? []).includes(root.systemKey);
}

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

const SORTERS: Record<StorageSort, (a: StoredFile, b: StoredFile) => number> = {
  NEWEST: (a, b) => b.createdAt.localeCompare(a.createdAt),
  OLDEST: (a, b) => a.createdAt.localeCompare(b.createdAt),
  NAME: (a, b) => collator.compare(a.name, b.name),
  SIZE: (a, b) => b.size - a.size,
};

export function filterFiles(files: StoredFile[], folders: Folder[], opts: { tab: StorageTab; query: string; sort: StorageSort; folderId?: string }): StoredFile[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const q = normalizeVi(opts.query.trim());
  return files
    .filter((f) => (opts.folderId ? f.folderId === opts.folderId : true))
    .filter((f) => inTab(f, opts.tab, byId))
    .filter((f) => !q || normalizeVi(f.name).includes(q) || normalizeVi(byId.get(f.folderId)?.name ?? "").includes(q))
    .sort(SORTERS[opts.sort]);
}

/** Files per folder; a top-level folder also counts its sub-folders' files, as the folder card shows. */
export function folderCounts(files: StoredFile[], folders: Folder[]): Map<string, number> {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const counts = new Map<string, number>();
  const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const file of files) {
    bump(file.folderId);
    const parent = byId.get(file.folderId)?.parentId;
    if (parent) bump(parent);
  }
  return counts;
}

const CATEGORY_FOLDER: Partial<Record<Category, SystemFolderKey>> = { HEALTH: "HEALTH", STUDY: "STUDY", DOCUMENT: "DOCUMENTS" };
const KIND_FOLDER: Record<FileKind, SystemFolderKey> = { IMAGE: "PHOTOS", VIDEO: "VIDEOS", DOCUMENT: "DOCUMENTS", AUDIO: "OTHER", OTHER: "OTHER" };

/** Where a new upload goes: the open folder, else the folder of the tab or item category, else by file kind. */
export function uploadTarget(folders: Folder[], ctx: { kind: FileKind; folderId?: string; tab?: StorageTab; category?: Category }): string | undefined {
  if (ctx.folderId) return ctx.folderId;
  const bySystem = (key: SystemFolderKey | undefined) => (key ? folders.find((f) => f.systemKey === key)?.id : undefined);
  const tabFolders = ctx.tab ? FOLDER_TABS[ctx.tab] : undefined;
  return bySystem(tabFolders?.length === 1 ? tabFolders[0] : undefined) ?? bySystem(ctx.category ? CATEGORY_FOLDER[ctx.category] : undefined) ?? bySystem(KIND_FOLDER[ctx.kind]);
}
