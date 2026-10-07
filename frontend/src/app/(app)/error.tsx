"use client";

import { ErrorState } from "@/design/components";

// Catches IndexedDB failures (blocked storage, private mode quirks) so one screen fails instead of the whole shell.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState onRetry={reset} />;
}
