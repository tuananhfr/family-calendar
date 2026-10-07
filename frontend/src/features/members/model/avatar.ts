import type { Relationship } from "@/core/model/common";
import type { AvatarPreset } from "@/design/components";

export const AVATAR_PRESETS = ["father", "mother", "boy", "girl", "grandfather", "grandmother", "guardian"] as const satisfies readonly AvatarPreset[];
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
/** Longest side after client-side resize; keeps IndexedDB small and strips most metadata. */
export const AVATAR_MAX_SIDE = 512;

/** Explicit "letters only" choice, so the role illustration isn't forced back on. */
export const INITIALS_AVATAR = "initials";

export type AvatarRef = { kind: "preset"; preset: AvatarPreset } | { kind: "blob"; id: string };

// Stored in Member.avatar as "preset:<key>" or "blob:<blob id>" so a single string field covers both.
export function avatarValue(ref: AvatarRef): string {
  return ref.kind === "preset" ? `preset:${ref.preset}` : `blob:${ref.id}`;
}

export function parseAvatar(value: string | undefined): AvatarRef | null {
  if (!value) return null;
  const [kind, rest] = [value.slice(0, value.indexOf(":")), value.slice(value.indexOf(":") + 1)];
  if (kind === "preset" && (AVATAR_PRESETS as readonly string[]).includes(rest)) return { kind: "preset", preset: rest as AvatarPreset };
  if (kind === "blob" && rest) return { kind: "blob", id: rest };
  return null;
}

const DEFAULT_PRESET: Partial<Record<Relationship, AvatarPreset>> = {
  FATHER: "father",
  MOTHER: "mother",
  SON: "boy",
  DAUGHTER: "girl",
  GRANDFATHER: "grandfather",
  GRANDMOTHER: "grandmother",
  GUARDIAN: "guardian",
};

export function defaultPresetFor(r: Relationship | ""): AvatarPreset | undefined {
  return r ? DEFAULT_PRESET[r] : undefined;
}

export function validateAvatarFile(f: { type: string; size: number }): "FILE_TYPE" | "FILE_TOO_LARGE" | null {
  if (!(AVATAR_MIME as readonly string[]).includes(f.type)) return "FILE_TYPE";
  if (f.size > MAX_AVATAR_BYTES) return "FILE_TOO_LARGE";
  return null;
}
