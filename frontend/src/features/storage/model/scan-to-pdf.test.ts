import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { scanPagesToPdf } from "./scan-to-pdf";

const image = async (format: "jpeg" | "png" | "webp", width = 300, height = 400) => {
  const buf = await sharp({ create: { width, height, channels: 3, background: "#eee" } })
    [format]()
    .toBuffer();
  return new Blob([new Uint8Array(buf)], { type: `image/${format}` });
};

describe("scanPagesToPdf", () => {
  it("two photos → a two-page PDF", async () => {
    const pdf = await scanPagesToPdf([await image("jpeg"), await image("png", 800, 400)]);
    expect(pdf.type).toBe("application/pdf");
    const doc = await PDFDocument.load(await pdf.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
  });

  it("converts formats pdf-lib can't embed through the converter", async () => {
    const toJpeg = async (b: Blob) =>
      new Blob([
        new Uint8Array(
          await sharp(Buffer.from(await b.arrayBuffer()))
            .jpeg()
            .toBuffer(),
        ),
      ]);
    const pdf = await scanPagesToPdf([await image("webp")], { toJpeg });
    expect((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount()).toBe(1);
  });

  it("refuses an empty scan and undecodable images", async () => {
    await expect(scanPagesToPdf([])).rejects.toThrow("NO_PAGES");
    await expect(scanPagesToPdf([await image("webp")])).rejects.toThrow("UNSUPPORTED_IMAGE");
  });
});
