"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SearchShortcut() {
  const router = useRouter();
  useEffect(() => {
    const open = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !event.altKey && !event.isComposing) { event.preventDefault(); router.push("/tim-kiem/"); } };
    window.addEventListener("keydown", open); return () => window.removeEventListener("keydown", open);
  }, [router]);
  return null;
}
