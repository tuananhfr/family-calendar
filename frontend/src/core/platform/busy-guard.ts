export type BusyReason = "form" | "recording" | "sos" | "upload";

// One entry per holder, so two open forms don't release each other.
const holders = new Set<symbol>();
const listeners = new Set<(busy: boolean) => void>();

function emit(busy: boolean): void {
  for (const l of listeners) l(busy);
}

/** Marks the app busy (UpdatePrompt never reloads while busy); returns an idempotent release. */
export function markBusy(reason: BusyReason): () => void {
  const token = Symbol(reason);
  const wasBusy = holders.size > 0;
  holders.add(token);
  if (!wasBusy) emit(true);
  return () => {
    if (!holders.delete(token)) return;
    if (holders.size === 0) emit(false);
  };
}

export function isBusy(): boolean {
  return holders.size > 0;
}

/** Called only when busy flips, so UpdatePrompt can show "Có bản cập nhật" once the last form closes. */
export function onBusyChange(listener: (busy: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetBusyForTests(): void {
  holders.clear();
  listeners.clear();
}
