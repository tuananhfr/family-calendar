"use client";

import { useSyncExternalStore } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "../cn";

export type ToastTone = "info" | "success" | "error";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function dismissToast(id: number) {
  items = items.filter((i) => i.id !== id);
  emit();
}

/** Transient feedback only; persistent problems belong in an inline ErrorState. */
export function toast(message: string, tone: ToastTone = "info", durationMs = 4000) {
  const id = nextId++;
  items = [...items.slice(-2), { id, tone, message }];
  emit();
  setTimeout(() => dismissToast(id), durationMs);
  return id;
}

const ICONS = { info: Info, success: CircleCheck, error: CircleAlert } as const;
const TONES = { info: "text-primary", success: "text-success", error: "text-danger" } as const;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const EMPTY: ToastItem[] = [];

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6">
      {list.map((it) => {
        const Icon = ICONS[it.tone];
        return (
          <div key={it.id} role={it.tone === "error" ? "alert" : "status"} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-control border border-border bg-surface p-3 shadow-pop">
            <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", TONES[it.tone])} />
            <p className="min-w-0 flex-1 text-sm text-text">{it.message}</p>
            <button type="button" aria-label={t("ui.dismiss")} onClick={() => dismissToast(it.id)} className="shrink-0 rounded-control p-1 text-muted hover:text-primary">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
