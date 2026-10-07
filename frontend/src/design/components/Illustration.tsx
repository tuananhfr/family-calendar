import Image from "next/image";
import { withBase } from "@/core/config";
import { cn } from "../cn";
import { ILLUSTRATION_SIZES, type IllustrationName } from "../illustration-sizes";

export type { IllustrationName };

/** Sized by height; width follows the crop's real aspect so layout space is reserved before load. */
export function Illustration({ name, height, alt = "", className, priority }: { name: IllustrationName; height: number; alt?: string; className?: string; priority?: boolean }) {
  const [w, h] = ILLUSTRATION_SIZES[name];
  return (
    <Image
      src={withBase(`/illustrations/${name}@2x.webp`)}
      width={Math.round((height * w) / h)}
      height={height}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      priority={priority}
      className={cn("shrink-0 select-none rounded-control object-contain", className)}
    />
  );
}
