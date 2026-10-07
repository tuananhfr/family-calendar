/** modules.md §9: WebP thumbnail, longest side ≤ 320 px, made on the client. */
export const THUMBNAIL_MAX_PX = 320;

/**
 * Thumbnail of an image, or null when the browser can't decode it (HEIC on Chrome, Node) — the file is still
 * stored, the grid then shows the extension badge.
 */
export async function makeThumbnail(image: Blob, maxPx: number = THUMBNAIL_MAX_PX): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") return null;
  let bitmap: ImageBitmap | null = null;
  try {
    // from-image applies EXIF orientation, so a portrait phone photo isn't drawn sideways.
    bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const webp = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
    // Safari encodes PNG when asked for WebP; keep whatever it produced rather than failing.
    return webp.size > 0 ? webp : null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
