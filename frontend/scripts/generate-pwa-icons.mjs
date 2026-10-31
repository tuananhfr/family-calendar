import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const iconDir = path.join(root, "public/icons");
const source = path.join(root, "public/brand/family-calendar-mark-source-20261031.png");
const faviconSource = path.join(root, "public/brand/family-calendar-favicon-20261031.svg");

export async function generatePwaIcons() {
  const metadata = await sharp(source).metadata();
  if (!metadata.width || metadata.width !== metadata.height) throw new Error("PWA icon source must be square");

  const png = (size) => sharp(source).resize(size, size).flatten({ background: "#ffffff" }).ensureAlpha().png().toBuffer();
  for (const [name, size] of [["icon-192-20261031.png", 192], ["icon-512-20261031.png", 512], ["apple-touch-icon-20261031.png", 180]]) {
    await fs.writeFile(path.join(iconDir, name), await png(size));
  }

  const favicon = (size) => sharp(faviconSource).resize(size, size).png().toBuffer();
  await fs.writeFile(path.join(iconDir, "favicon-48-20261031.png"), await favicon(48));

  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map(favicon));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index];
    header[entry + 1] = sizes[index];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  await fs.writeFile(path.join(root, "src/app/favicon.ico"), Buffer.concat([header, ...images]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await generatePwaIcons();
  console.log("Generated PWA, Apple and favicon assets from the approved icon source");
}
