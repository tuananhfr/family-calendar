// Minimal EXIF handling for JPEG: enough to drop GPS (modules.md §9) and read orientation/capture time.
// Malformed or non-JPEG input is returned unchanged: no browser or viewer could read GPS from it either.

const TAG_ORIENTATION = 0x0112;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\0";

interface Tiff {
  view: DataView;
  /** Absolute offset of the TIFF header inside the buffer. */
  base: number;
  /** End (exclusive) of the APP1 segment; nothing outside it may be read or written. */
  end: number;
  le: boolean;
}

interface IfdEntry {
  /** Absolute offset of the 12-byte entry. */
  at: number;
  tag: number;
  type: number;
  count: number;
  value: number;
}

class Malformed extends Error {}

function ascii(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + length));
}

function u16(t: Tiff, abs: number): number {
  if (abs + 2 > t.end) throw new Malformed();
  return t.view.getUint16(abs, t.le);
}

function u32(t: Tiff, abs: number): number {
  if (abs + 4 > t.end) throw new Malformed();
  return t.view.getUint32(abs, t.le);
}

function readIfd(t: Tiff, offset: number): { count: number; entries: IfdEntry[] } {
  const start = t.base + offset;
  const count = u16(t, start);
  if (start + 2 + count * 12 + 4 > t.end) throw new Malformed();
  const entries: IfdEntry[] = [];
  for (let i = 0; i < count; i++) {
    const at = start + 2 + i * 12;
    entries.push({ at, tag: u16(t, at), type: u16(t, at + 2), count: u32(t, at + 4), value: u32(t, at + 8) });
  }
  return { count, entries };
}

interface Segment {
  marker: number;
  start: number;
  end: number;
}

function segments(bytes: Uint8Array): Segment[] {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Malformed();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: Segment[] = [];
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) throw new Malformed();
    const marker = bytes[pos + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const end = pos + 2 + view.getUint16(pos + 2);
    if (end > bytes.length) throw new Malformed();
    out.push({ marker, start: pos, end });
    pos = end;
  }
  return out;
}

function exifTiff(bytes: Uint8Array, seg: Segment): Tiff | null {
  if (seg.marker !== 0xe1 || ascii(bytes, seg.start + 4, 6) !== "Exif\0\0") return null;
  const base = seg.start + 10;
  const order = ascii(bytes, base, 2);
  if (order !== "II" && order !== "MM") throw new Malformed();
  return { view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), base, end: seg.end, le: order === "II" };
}

function removeGps(bytes: Uint8Array, t: Tiff): void {
  const ifd0Offset = u32(t, t.base + 4);
  const ifd0 = readIfd(t, ifd0Offset);
  const index = ifd0.entries.findIndex((e) => e.tag === TAG_GPS_IFD);
  if (index < 0) return;

  const gps = readIfd(t, ifd0.entries[index].value);
  for (const e of gps.entries) {
    const size = (TYPE_SIZES[e.type] ?? 1) * e.count;
    if (size > 4 && t.base + e.value + size <= t.end) bytes.fill(0, t.base + e.value, t.base + e.value + size);
  }
  const gpsStart = t.base + ifd0.entries[index].value;
  bytes.fill(0, gpsStart, gpsStart + 2 + gps.count * 12 + 4);

  // Drop the pointer entry: later entries and the next-IFD link move up 12 bytes. Other offsets are relative to
  // the TIFF header, so nothing else shifts.
  const first = t.base + ifd0Offset + 2;
  const from = first + (index + 1) * 12;
  const tailEnd = first + ifd0.count * 12 + 4;
  bytes.copyWithin(from - 12, from, tailEnd);
  bytes.fill(0, tailEnd - 12, tailEnd);
  t.view.setUint16(t.base + ifd0Offset, ifd0.count - 1, t.le);
}

/** Removes the GPS IFD (and any XMP packet, which can repeat the coordinates); keeps orientation and the rest. */
export function stripGpsExif(jpeg: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(jpeg.slice(0));
  try {
    const segs = segments(bytes);
    for (const seg of segs) {
      const t = exifTiff(bytes, seg);
      if (t) removeGps(bytes, t);
    }
    const xmp = segs.filter((s) => s.marker === 0xe1 && ascii(bytes, s.start + 4, XMP_HEADER.length) === XMP_HEADER);
    if (xmp.length === 0) return bytes.buffer;
    const parts: Uint8Array[] = [];
    let pos = 0;
    for (const s of xmp) {
      parts.push(bytes.subarray(pos, s.start));
      pos = s.end;
    }
    parts.push(bytes.subarray(pos));
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out.buffer;
  } catch (error) {
    if (error instanceof Malformed || error instanceof RangeError) return jpeg.slice(0);
    throw error;
  }
}

export interface ExifSummary {
  orientation?: number;
  /** 'YYYY-MM-DDTHH:mm' wall time of capture (EXIF has no time zone). */
  takenAt?: string;
  hasGps: boolean;
}

export function readExif(jpeg: ArrayBuffer): ExifSummary {
  const bytes = new Uint8Array(jpeg);
  try {
    for (const seg of segments(bytes)) {
      const t = exifTiff(bytes, seg);
      if (!t) continue;
      const ifd0 = readIfd(t, u32(t, t.base + 4));
      const out: ExifSummary = { hasGps: ifd0.entries.some((e) => e.tag === TAG_GPS_IFD) };
      const orientation = ifd0.entries.find((e) => e.tag === TAG_ORIENTATION);
      if (orientation) out.orientation = u16(t, orientation.at + 8);
      const exif = ifd0.entries.find((e) => e.tag === TAG_EXIF_IFD);
      const dt = exif && readIfd(t, exif.value).entries.find((e) => e.tag === TAG_DATETIME_ORIGINAL);
      if (dt && dt.count >= 19 && t.base + dt.value + 19 <= t.end) {
        const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/.exec(ascii(bytes, t.base + dt.value, 19));
        if (m) out.takenAt = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
      }
      return out;
    }
  } catch (error) {
    if (!(error instanceof Malformed || error instanceof RangeError)) throw error;
  }
  return { hasGps: false };
}
