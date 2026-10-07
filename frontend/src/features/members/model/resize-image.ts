import { AVATAR_MAX_SIDE } from "./avatar";

/**
 * Re-encodes a photo through a canvas: shrinks it to AVATAR_MAX_SIDE and drops EXIF (including GPS) as a side effect.
 * Browser-only; throws "IMAGE_UNREADABLE" when the file can't be decoded.
 */
export async function resizeAvatar(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("IMAGE_UNREADABLE");
  }
  const scale = Math.min(1, AVATAR_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("IMAGE_UNREADABLE");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!out) throw new Error("IMAGE_UNREADABLE");
  return out;
}
