"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, Cloud, FolderOpen, FolderPlus, LayoutGrid, List, ScanLine, Search, ShieldAlert, Trash2 } from "lucide-react";
import type { Folder, StoredFile } from "@/core/model/storage";
import { cn } from "@/design/cn";
import { Badge, Button, Card, controlClass, EmptyState, IconButton, PageHeader, Select, SkeletonList, Tabs, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { useStorage } from "../hooks/useStorage";
import { useUpload } from "../hooks/useUpload";
import { deleteFolder, FolderError } from "../model/file-actions";
import { filterFiles, folderCounts, STORAGE_SORTS, STORAGE_TABS, type StorageSort, type StorageTab } from "../model/storage-view";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { FileGrid } from "./FileGrid";
import { FileList } from "./FileList";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { FolderGrid } from "./FolderGrid";
import { ScanDialog } from "./ScanDialog";
import { UploadDropzone } from "./UploadDropzone";

const RECENT_COUNT = 12;
const VIEW_KEY = "fc.storage.view";
type ViewMode = "grid" | "list";

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CreateTile({ icon, label, onClick, status }: { icon: ReactNode; label: string; onClick?: () => void; status?: string }) {
  const body = (
    <>
      <span aria-hidden className="text-primary [&_svg]:size-5">
        {icon}
      </span>
      <span className="whitespace-nowrap text-sm font-semibold text-text">{label}</span>
      {status ? (
        <Badge tone="neutral" className="ml-auto">
          {status}
        </Badge>
      ) : null}
    </>
  );
  const box = "flex min-h-[var(--touch-min)] flex-wrap items-center gap-x-2.5 gap-y-1 rounded-control border border-border bg-surface-2 px-4 py-3";
  // Drive is a status card, not a button: there is nothing to click until sync exists (TEC-15).
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(box, "text-left transition-colors hover:border-primary hover:bg-primary-soft")}>
      {body}
    </button>
  ) : (
    <div className={box} title={t("storage.create.driveHint")}>
      {body}
    </div>
  );
}

/** `/kho-luu-tru` (IMG-F): folders, recent files, tabs by kind/folder, search, grid/list, quick upload, camera and scan. */
export function StoragePage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const store = useStorage();
  const { upload, pending } = useUpload(store.spaceId, store.folders);
  const [tab, setTab] = useState<StorageTab>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<StorageSort>("NEWEST");
  const [view, setView] = useState<ViewMode>(readView);
  const [openFile, setOpenFile] = useState<StoredFile>();
  const [dialog, setDialog] = useState<"folder" | "scan" | null>(null);
  const camera = useRef<HTMLInputElement>(null);

  const folderId = params.get("folder") ?? undefined;
  const folder = folderId ? store.folders.find((f) => f.id === folderId) : undefined;
  const parent = folder?.parentId ? store.folders.find((f) => f.id === folder.parentId) : undefined;
  const counts = useMemo(() => folderCounts(store.files, store.folders), [store.files, store.folders]);
  const topFolders = useMemo(() => {
    // System folders keep the mockup's order; the family's own follow by name.
    const order = ["PHOTOS", "DOCUMENTS", "STUDY", "HEALTH", "VIDEOS", "OTHER"];
    const rank = (f: Folder) => (f.systemKey ? order.indexOf(f.systemKey) : order.length);
    return store.folders.filter((f) => !f.parentId).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "vi"));
  }, [store.folders]);
  const subFolders = folder ? store.folders.filter((f) => f.parentId === folder.id) : [];
  const browsing = !folder && tab === "ALL" && !query.trim();
  const shown = useMemo(
    () => (browsing ? filterFiles(store.files, store.folders, { tab, query: "", sort: "NEWEST" }).slice(0, RECENT_COUNT) : filterFiles(store.files, store.folders, { tab, query, sort, folderId })),
    [browsing, store.files, store.folders, tab, query, sort, folderId],
  );

  const goFolder = (id?: string) => router.push(id ? `${pathname}?folder=${id}` : pathname);
  const changeView = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };
  const ctx = { folderId, tab };
  const removeFolder = async () => {
    if (!folder) return;
    try {
      await deleteFolder(folder.id);
      toast(t("storage.folderDialog.deleted", { name: folder.name }), "success");
      goFolder(folder.parentId ?? undefined);
    } catch (e) {
      if (e instanceof FolderError && e.code === "NOT_EMPTY") toast(t("storage.folderDialog.notEmpty"), "error");
      else {
        console.error(e);
        toast(t("items.errors.UNKNOWN"), "error");
      }
    }
  };

  const files =
    shown.length === 0 ? (
      <EmptyState
        className="rounded-card border border-dashed border-border"
        title={folder ? t("storage.empty.folderTitle") : browsing ? t("storage.empty.title") : t("storage.empty.searchTitle")}
        body={folder ? t("storage.empty.folderBody") : browsing ? t("storage.empty.body") : t("storage.empty.searchBody")}
      />
    ) : view === "list" ? (
      <FileList files={shown} folders={store.folders} timeZone={store.timeZone} onOpen={setOpenFile} />
    ) : (
      <FileGrid files={shown} timeZone={store.timeZone} onOpen={setOpenFile} />
    );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("storage.title")} subtitle={t("storage.subtitle")} icon={<FolderOpen />} illustration="corner-storage" />
      <Card padded={false} className="flex min-w-0 flex-col">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:p-5">
          <Tabs label={t("storage.tabsLabel")} value={tab} onValueChange={(v) => setTab(v as StorageTab)} items={STORAGE_TABS.map((x) => ({ value: x, label: t(`storage.tabs.${x}`) }))} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex min-w-[12rem] flex-1 items-center">
              <span className="sr-only">{t("storage.searchLabel")}</span>
              <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("storage.search")} className={cn(controlClass, "pl-9")} />
            </label>
            <div className="flex items-center gap-2">
              <Select
                label={t("storage.sortLabel")}
                hideLabel
                className="w-40"
                value={sort}
                onValueChange={(v) => setSort(v as StorageSort)}
                options={STORAGE_SORTS.map((s) => ({ value: s, label: t(`storage.sorts.${s}`) }))}
              />
              <div role="group" aria-label={t("storage.viewLabel")} className="flex gap-1">
                <IconButton
                  label={t("storage.views.list")}
                  icon={<List className="size-5" />}
                  aria-pressed={view === "list"}
                  variant={view === "list" ? "soft" : "outline"}
                  onClick={() => changeView("list")}
                />
                <IconButton
                  label={t("storage.views.grid")}
                  icon={<LayoutGrid className="size-5" />}
                  aria-pressed={view === "grid"}
                  variant={view === "grid" ? "soft" : "outline"}
                  onClick={() => changeView("grid")}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 p-4 md:p-5">
          {store.loading ? (
            <SkeletonList rows={5} />
          ) : folder ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => goFolder(parent?.id)}>
                  {parent ? parent.name : t("storage.back")}
                </Button>
                <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-text" data-testid="folder-title">
                  {folder.name}
                </h2>
                {store.canEdit && !folder.systemKey ? (
                  <Button variant="ghost" size="sm" className="text-danger" icon={<Trash2 className="size-4" />} onClick={() => void removeFolder()}>
                    {t("storage.folderDialog.delete")}
                  </Button>
                ) : null}
              </div>
              {folder.dataClass === "SENSITIVE" ? (
                <p className="flex items-start gap-2 rounded-control bg-surface-2 px-3 py-2 text-sm text-body">
                  <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--cat-health-dot)]" />
                  {t("storage.sensitiveFolder")}
                </p>
              ) : null}
              {subFolders.length > 0 ? (
                <Section title={t("storage.subfolders")}>
                  <FolderGrid folders={subFolders} counts={counts} onOpen={(f) => goFolder(f.id)} />
                </Section>
              ) : null}
              <Section title={t("storage.folderFiles")}>{files}</Section>
            </>
          ) : browsing ? (
            <>
              <Section title={t("storage.folders")}>
                <FolderGrid folders={topFolders} counts={counts} onOpen={(f) => goFolder(f.id)} />
              </Section>
              <Section title={t("storage.recent")}>{files}</Section>
            </>
          ) : (
            <Section title={t("storage.results", { n: shown.length })}>{files}</Section>
          )}
        </div>

        {store.loading ? null : store.canEdit ? (
          <div className="grid gap-5 border-t border-border p-4 md:p-5 lg:grid-cols-2">
            <Section title={t("storage.upload.title")}>
              <UploadDropzone onFiles={(fs) => void upload(fs, ctx)} pending={pending} />
            </Section>
            <Section title={t("storage.create.title")}>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* One level of sub-folders: inside a sub-folder the new one goes next to it. */}
                <CreateTile icon={<FolderPlus />} label={t("storage.create.folder")} onClick={() => setDialog("folder")} />
                <CreateTile icon={<Cloud />} label={t("storage.create.drive")} status={t("storage.create.driveStatus")} />
                <CreateTile icon={<Camera />} label={t("storage.create.camera")} onClick={() => camera.current?.click()} />
                <CreateTile icon={<ScanLine />} label={t("storage.create.scan")} onClick={() => setDialog("scan")} />
              </div>
              <input
                ref={camera}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                aria-label={t("storage.create.cameraLabel")}
                onChange={(e) => {
                  const fs = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  void upload(fs, ctx);
                }}
              />
            </Section>
          </div>
        ) : (
          <p className="border-t border-border px-5 py-3 text-sm text-muted">{t("storage.upload.readOnly")}</p>
        )}
      </Card>

      {openFile ? <FilePreviewDialog fileId={openFile.id} timeZone={store.timeZone} canDelete={store.canDeleteFile(openFile)} onClose={() => setOpenFile(undefined)} /> : null}
      {dialog === "folder" && store.spaceId ? <CreateFolderDialog spaceId={store.spaceId} parent={folder ? (parent ?? folder) : undefined} onClose={() => setDialog(null)} /> : null}
      <ScanDialog open={dialog === "scan"} onOpenChange={(o) => setDialog(o ? "scan" : null)} onCreate={(pdf) => upload([pdf], ctx)} />
    </div>
  );
}
