"use client";

import type { Relationship } from "@/core/model/common";
import { Avatar, type AvatarSize } from "@/design/components";
import { useBlobUrl } from "../hooks/useBlobUrl";
import { defaultPresetFor, INITIALS_AVATAR, parseAvatar } from "../model/avatar";

export interface MemberAvatarProps {
  name: string;
  avatar?: string;
  relationship: Relationship | "";
  size?: AvatarSize;
  /** Unsaved photo preview (object URL) shown instead of the stored avatar. */
  overrideSrc?: string;
  ring?: boolean;
  className?: string;
}

export function MemberAvatar({ name, avatar, relationship, size = "md", overrideSrc, ring, className }: MemberAvatarProps) {
  const ref = parseAvatar(avatar);
  const blobUrl = useBlobUrl(ref?.kind === "blob" ? ref.id : undefined);
  // No avatar chosen yet → role illustration; the explicit "initials" choice keeps the letter.
  const preset = ref?.kind === "preset" ? ref.preset : ref || avatar === INITIALS_AVATAR ? undefined : defaultPresetFor(relationship);
  return (
    <Avatar
      name={name || "?"}
      preset={overrideSrc || blobUrl ? undefined : preset}
      src={overrideSrc ?? blobUrl}
      size={size}
      ring={ring}
      className={className}
    />
  );
}
