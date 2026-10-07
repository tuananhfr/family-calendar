import Image from "next/image";
import { withBase } from "@/core/config";
import { cn } from "../cn";

export type AvatarPreset = "father" | "mother" | "boy" | "girl" | "grandfather" | "grandmother" | "guardian";
const SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 } as const;
export type AvatarSize = keyof typeof SIZES;

/** Vietnamese given names come last ("Bé An" → "A"). */
export function initialOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const last = words.at(-1) ?? "";
  return (Array.from(last)[0] ?? "?").toLocaleUpperCase("vi");
}

export interface AvatarProps {
  name: string;
  preset?: AvatarPreset;
  src?: string;
  size?: AvatarSize;
  colorVar?: string;
  ring?: boolean;
  className?: string;
}

export function Avatar({ name, preset, src, size = "md", colorVar = "--cat-study-bg", ring, className }: AvatarProps) {
  const px = SIZES[size];
  const image = src ?? (preset ? withBase(`/illustrations/avatar-${preset}@2x.webp`) : undefined);
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-text", ring && "ring-2 ring-surface", className)}
      style={{ width: px, height: px, background: `var(${colorVar})`, fontSize: px * 0.42 }}
      title={name}
    >
      {image ? (
        <Image src={image} alt={name} width={px} height={px} className="size-full object-cover" />
      ) : (
        <span role="img" aria-label={name}>
          {initialOf(name)}
        </span>
      )}
    </span>
  );
}
