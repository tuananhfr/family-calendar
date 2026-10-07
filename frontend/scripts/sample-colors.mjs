// Samples colors from the UI mockups so design tokens come from the source images, not guesses.
import sharp from "sharp";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../../docs/UI-UX");
const IMG_A = path.join(dir, "2aOboR3bf9BCIcDcRKpGQg7ref0GaQLfQvhRDtSq.jpg");

const regions = JSON.parse(process.argv[2] ?? "null") ?? [
  { name: "primary-button", file: IMG_A, x: 60, y: 172, w: 30, h: 16 },
  { name: "page-bg", file: IMG_A, x: 1180, y: 945, w: 20, h: 10 },
  { name: "card-bg", file: IMG_A, x: 1250, y: 700, w: 10, h: 10 },
  { name: "sidebar-active-bg", file: IMG_A, x: 150, y: 232, w: 30, h: 14 },
  { name: "title-text", file: IMG_A, x: 314, y: 215, w: 360, h: 30, mode: "darkest" },
  { name: "muted-text", file: IMG_A, x: 314, y: 282, w: 230, h: 12, mode: "darkest" },
  { name: "script-red", file: IMG_A, x: 240, y: 100, w: 150, h: 50, mode: "reddest" },
  { name: "event-blue-bg", file: IMG_A, x: 420, y: 528, w: 50, h: 10 },
  { name: "event-pink-bg", file: IMG_A, x: 600, y: 540, w: 50, h: 10 },
  { name: "event-green-bg", file: IMG_A, x: 780, y: 570, w: 40, h: 10 },
  { name: "event-yellow-bg", file: IMG_A, x: 960, y: 580, w: 50, h: 10 },
  { name: "event-purple-bg", file: IMG_A, x: 700, y: 712, w: 40, h: 8 },
  { name: "tag-green-bg", file: IMG_A, x: 1378, y: 455, w: 20, h: 10 },
  { name: "countdown-green", file: IMG_A, x: 1430, y: 680, w: 60, h: 12, mode: "darkest" },
  { name: "border", file: IMG_A, x: 300, y: 462, w: 2, h: 30 },
];

function hex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

const cache = new Map();
async function load(file) {
  if (!cache.has(file)) {
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    cache.set(file, { data, info });
  }
  return cache.get(file);
}

const out = {};
for (const r of regions) {
  const { data, info } = await load(r.file);
  let sum = [0, 0, 0], n = 0, best = null, bestScore = Infinity;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * info.width + x) * 3;
      const px = [data[i], data[i + 1], data[i + 2]];
      sum = sum.map((s, k) => s + px[k]); n++;
      const score = r.mode === "darkest" ? px[0] + px[1] + px[2] : r.mode === "reddest" ? -(px[0] - (px[1] + px[2]) / 2) : 0;
      if (score < bestScore) { bestScore = score; best = px; }
    }
  }
  out[r.name] = r.mode ? hex(...best) : hex(...sum.map((s) => s / n));
}
console.log(JSON.stringify(out, null, 2));
