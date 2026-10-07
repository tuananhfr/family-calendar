"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";
import type { Folder } from "@/core/model/storage";
import { Button, Dialog, TextField, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { createFolder, FolderError } from "../model/file-actions";

export function CreateFolderDialog({ spaceId, parent, onClose, onCreated }: { spaceId: string; parent?: Folder; onClose: () => void; onCreated?: (f: Folder) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const folder = await createFolder(spaceId, name, parent?.id ?? null);
      toast(t("storage.folderDialog.created", { name: folder.name }), "success");
      onCreated?.(folder);
      onClose();
    } catch (e) {
      if (e instanceof FolderError && (e.code === "REQUIRED" || e.code === "DUPLICATE")) setError(t(e.code === "REQUIRED" ? "storage.folderDialog.required" : "storage.folderDialog.duplicate"));
      else {
        console.error(e);
        toast(t("items.errors.UNKNOWN"), "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      size="sm"
      onOpenChange={(o) => !o && onClose()}
      icon={<FolderPlus />}
      title={parent ? t("storage.folderDialog.subTitle", { parent: parent.name }) : t("storage.folderDialog.title")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="create-folder" loading={busy}>
            {t("storage.folderDialog.create")}
          </Button>
        </>
      }
    >
      <form
        id="create-folder"
        className="pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextField
          label={t("storage.folderDialog.name")}
          required
          autoFocus
          maxLength={100}
          value={name}
          placeholder={t("storage.folderDialog.placeholder")}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          error={error}
        />
      </form>
    </Dialog>
  );
}
