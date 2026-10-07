import { fileKindFromMime, type FileKind } from "@/core/model/storage";

export { fileKindFromMime };

// Windows and some Android pickers report an empty `type` for files such as .heic or .docx.
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : "";
}

/** The browser's type, else a guess from the extension, else octet-stream. */
export function mimeOf(file: { type: string; name: string }): string {
  return file.type || MIME_BY_EXTENSION[extensionOf(file.name)] || "application/octet-stream";
}

export function kindOfFile(file: { type: string; name: string }): FileKind {
  return fileKindFromMime(mimeOf(file));
}

/** Badge on file thumbnails ('PDF', 'DOCX'); empty when there is no extension. */
export function extensionLabel(name: string): string {
  return extensionOf(name).toUpperCase().slice(0, 5);
}
