"use client";

import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";

/** Object URL for a stored blob, revoked when the blob changes or the component unmounts. */
export function useBlobUrl(blobId: string | undefined): string | undefined {
  const row = useLiveQuery(() => (blobId ? db.blobs.get(blobId) : undefined), [blobId]);
  const url = useMemo(() => (row ? URL.createObjectURL(row.data) : undefined), [row]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return url;
}
