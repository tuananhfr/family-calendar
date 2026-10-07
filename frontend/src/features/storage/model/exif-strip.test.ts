import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { readExif, stripGpsExif } from "./exif-strip";

/** Independent minimal reader: tag ids of IFD0 and the orientation value. */
function ifd0Tags(buf: ArrayBuffer): { tags: number[]; orientation?: number } {
  const b = new Uint8Array(buf);
  const at = Buffer.from(b).indexOf(Buffer.from("Exif\0\0"));
  if (at < 0) return { tags: [] };
  const base = at + 6;
  const v = new DataView(buf);
  const le = b[base] === 0x49;
  const ifd = base + v.getUint32(base + 4, le);
  const n = v.getUint16(ifd, le);
  const tags: number[] = [];
  let orientation: number | undefined;
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    const tag = v.getUint16(e, le);
    tags.push(tag);
    if (tag === 0x0112) orientation = v.getUint16(e + 8, le);
  }
  return { tags, orientation };
}

function hasLatitude(buf: ArrayBuffer): boolean {
  const b = Buffer.from(new Uint8Array(buf));
  const encode = (le: boolean) => {
    const out = Buffer.alloc(24);
    [10, 1, 46, 1, 30, 1].forEach((n, i) => (le ? out.writeUInt32LE(n, i * 4) : out.writeUInt32BE(n, i * 4)));
    return out;
  };
  return b.includes(encode(true)) || b.includes(encode(false));
}

function toArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

async function jpegWithGps(): Promise<ArrayBuffer> {
  const out = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#c00" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "Lich", Model: "Test" },
      IFD2: { DateTimeOriginal: "2026:10:05 07:15:30" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "10/1 46/1 30/1", GPSLongitudeRef: "E", GPSLongitude: "106/1 41/1 0/1" },
    })
    // sharp resets Orientation from withExif; withMetadata is the way to set it.
    .withMetadata({ orientation: 6 })
    .toBuffer();
  return toArrayBuffer(out);
}

describe("stripGpsExif", () => {
  it("removes the GPS IFD and keeps orientation", async () => {
    const src = await jpegWithGps();
    expect(ifd0Tags(src).tags).toContain(0x8825);

    const out = stripGpsExif(src);
    const parsed = ifd0Tags(out);
    expect(parsed.tags).not.toContain(0x8825);
    expect(parsed.orientation).toBe(6);
    // The latitude rationals 10/1 46/1 30/1 are gone from the bytes, not just unlinked.
    expect(hasLatitude(src)).toBe(true);
    expect(hasLatitude(out)).toBe(false);
    // Still a valid image for a real decoder.
    const meta = await sharp(Buffer.from(out)).metadata();
    expect(meta).toMatchObject({ width: 40, height: 20, orientation: 6 });
    expect(readExif(out)).toEqual({ orientation: 6, takenAt: "2026-10-05T07:15", hasGps: false });
  });

  it("reads capture time and GPS presence before stripping", async () => {
    expect(readExif(await jpegWithGps())).toEqual({ orientation: 6, takenAt: "2026-10-05T07:15", hasGps: true });
  });

  it("drops XMP packets, which can repeat the coordinates", async () => {
    const src = Buffer.from(await jpegWithGps());
    const xmp = Buffer.from("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><exif:GPSLatitude>10,46.5N</exif:GPSLatitude></x:xmpmeta>");
    const seg = Buffer.concat([Buffer.from([0xff, 0xe1, (xmp.length + 2) >> 8, (xmp.length + 2) & 0xff]), xmp]);
    const withXmp = Buffer.concat([src.subarray(0, 2), seg, src.subarray(2)]);
    const out = Buffer.from(stripGpsExif(toArrayBuffer(withXmp)));
    expect(out.includes(Buffer.from("GPSLatitude"))).toBe(false);
    expect((await sharp(out).metadata()).width).toBe(40);
  });

  it("returns other input unchanged", async () => {
    const png = toArrayBuffer(
      await sharp({ create: { width: 2, height: 2, channels: 3, background: "#000" } })
        .png()
        .toBuffer(),
    );
    expect(new Uint8Array(stripGpsExif(png))).toEqual(new Uint8Array(png));
    const plain = toArrayBuffer(
      await sharp({ create: { width: 2, height: 2, channels: 3, background: "#000" } })
        .jpeg()
        .toBuffer(),
    );
    expect(new Uint8Array(stripGpsExif(plain))).toEqual(new Uint8Array(plain));
    const junk = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2]).buffer;
    expect(new Uint8Array(stripGpsExif(junk))).toEqual(new Uint8Array(junk));
  });
});
