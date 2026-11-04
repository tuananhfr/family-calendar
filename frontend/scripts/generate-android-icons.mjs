import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Reuse the approved website logo; do not redraw or replace the brand artwork.
const root = path.resolve(import.meta.dirname, "../..");
const source = path.join(root, "frontend/public/brand/family-calendar-mark-transparent-source-20261031.png");
const resources = path.join(root, "android/app/src/main/res");

for (const [density, scale] of [["mdpi", 1], ["hdpi", 1.5], ["xhdpi", 2], ["xxhdpi", 3], ["xxxhdpi", 4]]) {
  const canvas = Math.round(108 * scale);
  const size = Math.round(60 * scale);
  const inset = Math.round((canvas - size) / 2);
  const logo = await sharp(source).resize(size, size).png().toBuffer();
  const directory = path.join(resources, `drawable-${density}`);
  await fs.mkdir(directory, { recursive: true });
  await sharp({ create: { width: canvas, height: canvas, channels: 4, background: "#00000000" } })
    .composite([{ input: logo, top: inset, left: inset }])
    .png()
    .toFile(path.join(directory, "ic_launcher_foreground.png"));
}
console.log("Generated Android launcher icons from the existing Lịch Gia Đình logo.");
