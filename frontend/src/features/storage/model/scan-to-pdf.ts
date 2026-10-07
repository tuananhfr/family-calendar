import { PDFDocument } from "pdf-lib";

/** A4 portrait in PDF points. */
const A4: [number, number] = [595.28, 841.89];

type ImageFormat = "jpeg" | "png";

function sniff(bytes: Uint8Array): ImageFormat | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  return null;
}

/** Re-encodes an image pdf-lib can't embed (HEIC/WebP from a camera) as JPEG via the browser decoder. */
async function canvasToJpeg(image: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") throw new RangeError("UNSUPPORTED_IMAGE");
  const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new RangeError("UNSUPPORTED_IMAGE");
    ctx.drawImage(bitmap, 0, 0);
    return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  } finally {
    bitmap.close();
  }
}

/** "Quét tài liệu": one A4 page per photo, fitted and centred; no OCR (modules.md §9). */
export async function scanPagesToPdf(images: Blob[], opts: { toJpeg?: (image: Blob) => Promise<Blob> } = {}): Promise<Blob> {
  if (images.length === 0) throw new RangeError("NO_PAGES");
  const toJpeg = opts.toJpeg ?? canvasToJpeg;
  const pdf = await PDFDocument.create();
  pdf.setProducer("Lịch Gia Đình");
  for (const image of images) {
    let bytes = new Uint8Array(await image.arrayBuffer());
    let format = sniff(bytes);
    if (!format) {
      bytes = new Uint8Array(await (await toJpeg(image)).arrayBuffer());
      format = sniff(bytes);
      if (!format) throw new RangeError("UNSUPPORTED_IMAGE");
    }
    const embedded = format === "jpeg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    const page = pdf.addPage(A4);
    const scale = Math.min(A4[0] / embedded.width, A4[1] / embedded.height);
    const width = embedded.width * scale;
    const height = embedded.height * scale;
    page.drawImage(embedded, { x: (A4[0] - width) / 2, y: (A4[1] - height) / 2, width, height });
  }
  const out = await pdf.save();
  return new Blob([out as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
}
