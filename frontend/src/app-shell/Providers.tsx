"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, TooltipProvider } from "@/design/components";
import { useAppearanceSync } from "@/features/preferences/hooks/useAppearanceSync";

export function Providers({ children }: { children: ReactNode }) {
  useAppearanceSync();
  // One client per browser tab; created lazily so static prerender never shares cache between requests.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (count, err) => count < 2 && !(err instanceof Error && /\b4\d\d\b/.test(err.message)) },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
